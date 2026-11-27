import 'server-only';
import { cookies } from 'next/headers';
import { createApiClient } from '@exo/api-client';

// All public values (inlined at build), so a missing one fails at request time, never at build.
export const config = () => ({
  api: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  app: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? '',
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '',
});

export const COOKIE = { access: 'exo_at', refresh: 'exo_rt', oauth: 'exo_oauth', team: 'exo_team' } as const;
export const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' } as const;

/** Posts a form to Cognito's token endpoint. */
export async function tokenRequest(params: Record<string, string>) {
  const { domain, clientId } = config();
  const res = await fetch(`${domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, ...params }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}

/** API client acting as the signed-in user; null when signed out. */
export async function api() {
  const token = (await cookies()).get(COOKIE.access)?.value;
  // Local dev only: act as a DEV_AUTH user against a local API. Server-only env, never NEXT_PUBLIC.
  const dev = process.env.NODE_ENV !== 'production' ? process.env.DEV_USER : undefined;
  const headers: Record<string, string> | null = token ? { authorization: `Bearer ${token}` } : dev ? { 'x-dev-user': dev } : null;
  return headers && createApiClient(config().api, headers);
}

/** The signed-in user's teams and the one they are working in. */
export async function session() {
  const client = await api();
  if (!client) return null;
  const [me, teams] = await Promise.all([client.GET('/v1/me'), client.GET('/v1/teams')]);
  if (!me.data || !teams.data) return null; // token rejected
  const picked = (await cookies()).get(COOKIE.team)?.value;
  const team = teams.data.find((t) => t.id === picked) ?? teams.data[0] ?? null;
  return { client, me: me.data, teams: teams.data, team };
}

export const isStaff = (role?: string) => role === 'owner' || role === 'coach';
