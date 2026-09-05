/**
 * Says which database this checkout is pointed at.
 *
 * The Vercel CLI writes a .env.local holding the production connection string,
 * and Next loads it ahead of .env. That silently turns local development into
 * production, so it is worth being able to ask.
 */
import { existsSync, readFileSync } from 'node:fs';

function urlFrom(file) {
  if (!existsSync(file)) return null;
  const m = readFileSync(file, 'utf8').match(/^DATABASE_URL=\s*"?([^"\r\n]+)/m);
  return m ? m[1] : null;
}

const local = urlFrom('.env.local');
const base = urlFrom('.env');
const inUse = local ?? base;

if (!inUse) {
  console.log('No DATABASE_URL found in .env.local or .env');
  process.exit(1);
}

const host = new URL(inUse).host;
const isLocal = /^(127\.0\.0\.1|localhost)/.test(host);

if (local) {
  console.log('.env.local exists and WINS over .env');
}
console.log(isLocal ? `local database (${host})` : `REMOTE DATABASE (${host}) — delete .env.local to work locally`);
