import createClient from 'openapi-fetch';
import type { paths } from './schema.d.ts';

export type { paths, components } from './schema.d.ts';

/** Typed client for the eXO API. Regenerate types with `pnpm api:generate` after changing routes. */
export function createApiClient(baseUrl: string, headers?: HeadersInit) {
  return createClient<paths>({ baseUrl, headers });
}
