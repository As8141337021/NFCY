import { db } from './src/lib/db';
const n = await db.rateLimit.deleteMany({});
console.log('rate limit rows cleared:', n.count);
await db.$disconnect();
