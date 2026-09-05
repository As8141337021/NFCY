/**
 * A real PostgreSQL for local development, with nothing to install.
 * `embedded-postgres` ships the actual Postgres binaries and runs them
 * against a data directory inside the project. Production uses a managed
 * Postgres through DATABASE_URL and never touches this file.
 *
 *   npm run pg:start     starts it and stays in the foreground
 *   npm run pg:stop      stops a running instance
 */
import EmbeddedPostgres from 'embedded-postgres';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, '.pgdata');
const PORT = Number(process.env.DEV_PG_PORT ?? 5433);
// These name the Postgres cluster already on disk, not the brand. Renaming
// them would point the app at a database that does not exist and silently
// orphan every row in the one that does.
const USER = 'contap';
const PASSWORD = 'contap_dev';
const DB = 'contap';

const cmd = process.argv[2] ?? 'start';

function makeInstance() {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    // Without this, initdb inherits the Windows system locale and creates a
    // WIN1252 cluster. The rupee sign then cannot be stored at all, which is a
    // spectacular way to break an Indian product in development only.
    // Managed Postgres is UTF8 by default; this makes the dev copy match.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: () => {},
  });
}

async function start() {
  const fresh = !fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));
  const pg = makeInstance();

  if (fresh) {
    console.log('[devdb] first run, initialising the data directory');
    await pg.initialise();
  }

  await pg.start();
  console.log(`[devdb] postgres listening on 127.0.0.1:${PORT}`);

  if (fresh) {
    await pg.createDatabase(DB);
    console.log(`[devdb] created database "${DB}"`);
  }

  // Prove the cluster can actually hold a rupee sign before anything is built
  // on top of it. A silent WIN1252 database is a very expensive surprise later.
  try {
    const client = pg.getPgClient(DB);
    await client.connect();
    const { rows } = await client.query('SHOW server_encoding');
    const encoding = String(rows[0]?.server_encoding ?? 'unknown');
    if (encoding.toUpperCase() !== 'UTF8') {
      console.error(`[devdb] FATAL: this database is ${encoding}, not UTF8.`);
      console.error('[devdb] The rupee sign and Indian language text cannot be stored.');
      console.error('[devdb] Stop this, delete the .pgdata folder, and start again.');
      await client.end();
      process.exit(1);
    }
    await client.query("SELECT '₹ test'::text");
    console.log(`[devdb] encoding ${encoding}, rupee sign round trips`);
    await client.end();
  } catch (e) {
    console.error('[devdb] could not verify the encoding:', e);
  }

  const url = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`;
  console.log(`[devdb] DATABASE_URL=${url}`);
  console.log('[devdb] ready. Leave this running.');

  const stop = async () => {
    console.log('\n[devdb] stopping');
    try { await pg.stop(); } catch { /* already gone */ }
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  // hold the process open
  setInterval(() => {}, 1 << 30);
}

async function stop() {
  const pg = makeInstance();
  try {
    await pg.stop();
    console.log('[devdb] stopped');
  } catch (e) {
    console.log('[devdb] nothing to stop');
  }
  process.exit(0);
}

if (cmd === 'stop') void stop();
else void start();
