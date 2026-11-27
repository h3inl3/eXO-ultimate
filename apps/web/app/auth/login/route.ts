import { createHash, randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, config, cookieOpts } from '../../../lib/session';

// Starts Cognito sign-in: authorization code + PKCE, state and verifier in a short-lived cookie.
export function GET(req: NextRequest) {
  const { app, domain, clientId } = config();
  const back = req.nextUrl.searchParams.get('returnTo') ?? '/';
  const returnTo = back.startsWith('/') && !back.startsWith('//') ? back : '/'; // no open redirect
  const state = randomBytes(16).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const url = new URL(`${domain}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${app}/auth/callback`,
    scope: 'openid email profile',
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set(COOKIE.oauth, JSON.stringify({ state, verifier, returnTo }), { ...cookieOpts, path: '/auth', maxAge: 600 });
  return res;
}
