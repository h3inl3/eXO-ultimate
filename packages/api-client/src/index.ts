import createClient from 'openapi-fetch';
import type { paths } from './schema.d.ts';

export type { paths, components } from './schema.d.ts';

/**
 * Typed client for the eXO API. Regenerate types with `pnpm api:generate` after changing routes.
 * `getToken` is called before each request (mobile refreshes its access token there).
 */
export function createApiClient(
  baseUrl: string,
  headers?: Record<string, string>,
  getToken?: () => Promise<string | null>,
) {
  const client = createClient<paths>({ baseUrl, headers });
  if (getToken) {
    client.use({
      async onRequest({ request }) {
        const token = await getToken();
        if (token) request.headers.set('authorization', `Bearer ${token}`);
        return request;
      },
    });
  }
  return client;
}
