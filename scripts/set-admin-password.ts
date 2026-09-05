/**
 * Sets the admin password on whichever database DATABASE_URL points at.
 * Used once against production, because the seed reads .env and would
 * otherwise carry a development password into the live site.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
const email = process.env.ADMIN_EMAIL ?? 'admin@nfcy.in';
const password = process.env.ADMIN_PASSWORD;

if (!password) {
  console.error('Set ADMIN_PASSWORD in the environment.');
  process.exit(1);
}

async function main() {
  const hash = await bcrypt.hash(password!, 12);
  const user = await db.user.update({ where: { email }, data: { passwordHash: hash } });
  console.log(`password set for ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
