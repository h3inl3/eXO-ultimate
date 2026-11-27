import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, cookieOpts, tokenRequest } from './lib/session';

// Server Components can't set cookies, so an expired access token is refreshed here, before rendering.
export async function proxy(req: NextRequest) {
  const refresh = req.cookies.get(COOKIE.refresh)?.value;
  if (req.cookies.has(COOKIE.access) || !refresh) return NextResponse.next();
  const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh });
  if (!tokens) {
    const res = NextResponse.next();
    res.cookies.delete(COOKIE.refresh); // revoked or expired: signed out
    return res;
  }
  req.cookies.set(COOKIE.access, tokens.access_token); // so this same render sees it
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set(COOKIE.access, tokens.access_token, { ...cookieOpts, maxAge: tokens.expires_in - 60 });
  return res;
}

export const config = { matcher: ['/((?!_next/|auth/|favicon).*)'] };
