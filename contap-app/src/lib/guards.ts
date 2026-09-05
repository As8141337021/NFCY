import 'server-only';
import { redirect } from 'next/navigation';
import { currentUser, isStaff, can, type Permission, type SessionUser } from './auth';

/** For pages, not APIs: bounces to sign in and comes back afterwards. */
export async function requireUserOrRedirect(next?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  return user;
}

export async function requireStaffOrRedirect(permission: Permission): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=/admin`);
  if (!isStaff(user.role)) redirect('/dashboard');
  if (!can(user.role, permission)) redirect('/admin');
  return user;
}
