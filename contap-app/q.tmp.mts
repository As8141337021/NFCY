import { db } from './src/lib/db';
const p = await db.profile.findUnique({ where: { username: 'meerajoshibumtfbeez2' }, select: { id: true } });
console.log(p?.id ?? '');
await db.$disconnect();
