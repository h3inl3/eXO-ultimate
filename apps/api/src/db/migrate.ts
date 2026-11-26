import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { connectionOptions, url } from './client.ts';

/**
 * Applies pending Drizzle migrations. Several instances can start at once, so a session-level
 * advisory lock on a single connection makes the others wait instead of racing.
 * `MIGRATIONS_DIR` points at the folder shipped beside the Lambda bundle.
 */
export async function migrateWithLock() {
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('../../drizzle', import.meta.url));
  const conn = postgres(url, { ...connectionOptions, max: 1 });
  try {
    await conn`select pg_advisory_lock(726173)`;
    await migrate(drizzle(conn), { migrationsFolder });
  } finally {
    await conn.end();
  }
}
