import 'server-only';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import type { Role, User } from '@prisma/client';
import { db } from './db';
import { env } from './env';
import { randomToken, sha256, safeEqual } from './ids';

export const SESSION_COOKIE = 'nfcy_session';
const SESSION_DAYS = 30;

// ============================================================
// PASSWORDS
// ============================================================

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  // Always run a comparison, even with no hash on the account, so that a
  // request for a passwordless account takes the same time as a wrong password.
  const target = hash ?? '$2a$12$0000000000000000000000000000000000000000000000000000';
  const ok = await bcrypt.compare(plain, target);
  return hash ? ok : false;
}

/** Returns the reasons a password is unacceptable. Empty array means it is fine. */
export function passwordProblems(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 8) out.push('at least 8 characters');
  if (!/[a-z]/.test(pw)) out.push('a lowercase letter');
  if (!/[A-Z]/.test(pw)) out.push('an uppercase letter');
  if (!/[0-9]/.test(pw)) out.push('a number');
  return out;
}

// ============================================================
// SESSIONS
// ============================================================

/**
 * The cookie carries a random token. Only its SHA-256 lands in the database,
 * so a database leak does not hand anyone a working session.
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  const h = await headers();
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      userAgent: h.get('user-agent')?.slice(0, 255) ?? null,
      ip: null, // deliberately not stored
      expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5),
    },
  });
  await db.user.update({ where: { id: userId }, data: { lastLogin: new Date() } });
  return token;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function destroySession(token: string) {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export type SessionUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'status' | 'emailVerified' | 'organizationId'>;

/** The signed-in user, or null. Safe to call anywhere on the server. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        select: {
          id: true, email: true, name: true, role: true,
          status: true, emailVerified: true, organizationId: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.status !== 'ACTIVE') return null;
  return session.user;
}

// ============================================================
// AUTHORISATION
// ============================================================

const RANK: Record<Role, number> = {
  CUSTOMER: 0,
  SALES: 10,
  MANUFACTURING: 10,
  SUPPORT: 20,
  OPERATIONS: 30,
  ADMIN: 40,
  SUPER_ADMIN: 50,
};

export const STAFF_ROLES: Role[] = ['SALES', 'MANUFACTURING', 'SUPPORT', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN'];

export function isStaff(role: Role) {
  return RANK[role] >= RANK.SALES;
}

export function atLeast(role: Role, minimum: Role) {
  return RANK[role] >= RANK[minimum];
}

/**
 * What each role is allowed to do. Checked on the server for every admin action,
 * never inferred from what the interface happens to render.
 */
export const PERMISSIONS = {
  'orders.view':     ['SALES', 'MANUFACTURING', 'SUPPORT', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN'],
  'orders.update':   ['OPERATIONS', 'ADMIN', 'SUPER_ADMIN'],
  'orders.ship':     ['MANUFACTURING', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN'],
  'products.view':   ['SALES', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN'],
  'products.manage': ['ADMIN', 'SUPER_ADMIN'],
  'cards.view':      ['MANUFACTURING', 'SUPPORT', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN'],
  'cards.manage':    ['MANUFACTURING', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN'],
  'users.view':      ['SUPPORT', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN'],
  'users.manage':    ['ADMIN', 'SUPER_ADMIN'],
  'profiles.view':   ['SUPPORT', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN'],
  'profiles.manage': ['OPERATIONS', 'ADMIN', 'SUPER_ADMIN'],
  'coupons.manage':  ['ADMIN', 'SUPER_ADMIN'],
  'analytics.view':  ['SALES', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN'],
  'settings.manage': ['SUPER_ADMIN'],
  'audit.view':      ['ADMIN', 'SUPER_ADMIN'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

// ============================================================
// GUARDS
// ============================================================

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, 'Please sign in to continue.', 'unauthenticated');
  return u;
}

export async function requireStaff(permission: Permission): Promise<SessionUser> {
  const u = await requireUser();
  if (!isStaff(u.role) || !can(u.role, permission)) {
    throw new HttpError(403, 'Your account cannot do that.', 'forbidden');
  }
  return u;
}

/** Throws unless the signed in user owns this profile, or is staff. */
export async function requireProfileAccess(profileId: string, user: SessionUser) {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, userId: true, username: true, status: true },
  });
  if (!profile) throw new HttpError(404, 'That profile does not exist.', 'not_found');
  if (profile.userId !== user.id && !isStaff(user.role)) {
    throw new HttpError(403, 'That profile belongs to someone else.', 'forbidden');
  }
  return profile;
}

export { safeEqual };
