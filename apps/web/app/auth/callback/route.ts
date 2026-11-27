import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, config, cookieOpts, tokenRequest } from '../../../lib/session';

export async function GET(req: NextRequest) {
  const { app } = config();
  const fail = NextResponse.redirect(`${app}/?signin=failed`);
  const saved = req.cookies.get(COOKIE.oauth)?.value;
  const code = req.nextUrl.searchParams.get('code');
  if (!saved || !code) return fail;
  const { state, verifier, returnTo } = JSON.parse(saved) as { state: string; verifier: string; returnTo: string };
  if (req.nextUrl.searchParams.get('state') !== state) return fail;

  const tokens = await tokenRequest({
    grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: `${app}/auth/callback`,
  });
  if (!tokens?.refresh_token) return fail;
  const res = NextResponse.redirect(`${app}${returnTo}`);
  res.cookies.delete({ name: COOKIE.oauth, path: '/auth' });
  // The access cookie dies a minute before the token, so proxy.ts refreshes it in time.
  res.cookies.set(COOKIE.access, tokens.access_token, { ...cookieOpts, maxAge: tokens.expires_in - 60 });
  res.cookies.set(COOKIE.refresh, tokens.refresh_token, { ...cookieOpts, maxAge: 30 * 86_400 });
  return res;
}
