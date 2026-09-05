import { db } from './src/lib/db';
const c = await db.nfcCard.findFirst({ where: { status: 'UNASSIGNED' }, select: { id: true } });
console.log(c?.id ?? '');
await db.$disconnect();
