/** Writes the OpenAPI spec for `@exo/api-client`. No database needed: postgres-js connects lazily. */
import { writeFileSync } from 'node:fs';

process.env.DATABASE_URL ??= 'postgres://unused@localhost/unused';
const { buildApp } = await import('./app.ts');
const app = buildApp();
await app.ready();
const out = new URL('../../../packages/api-client/openapi.json', import.meta.url);
writeFileSync(out, JSON.stringify(app.swagger(), null, 2) + '\n');
await app.close();
console.log(`wrote ${out.pathname}`);
