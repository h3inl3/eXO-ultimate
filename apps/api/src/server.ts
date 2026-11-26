import { buildApp } from './app.ts';
import { migrateWithLock } from './db/migrate.ts';

// Lambda Web Functions probes the host:port it advertises here; locally fall back to PORT.
const [host, port] = (process.env.AWS_LAMBDA_HTTP_ENDPOINT ?? `0.0.0.0:${process.env.PORT ?? 4000}`).split(':');

try {
  if (process.env.MIGRATE_ON_START === 'true') await migrateWithLock();
  const app = buildApp();
  await app.listen({ port: Number(port), host });
} catch (err) {
  console.error(err);
  process.exit(1);
}
