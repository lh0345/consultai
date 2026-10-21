import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Development convenience only: a real PostgreSQL cluster bound to loopback.
const databaseDir = resolve('.local/postgres');
const database = new EmbeddedPostgres({
  databaseDir, user: 'consultai', password: 'consultai', port: 54329,
  persistent: true, authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {}, onError: (error) => console.error(String(error)),
});
if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await database.initialise();
await database.start();
const client = database.getPgClient();
await client.connect();
const found = await client.query("SELECT 1 FROM pg_database WHERE datname = 'consultai'");
if (!found.rowCount) await client.query('CREATE DATABASE consultai');
await client.end();
console.log('PostgreSQL ready on 127.0.0.1:54329. Data: .local/postgres. Ctrl+C to stop.');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await database.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 60_000);
