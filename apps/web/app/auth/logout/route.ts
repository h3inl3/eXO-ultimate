import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, config } from '../../../lib/session';

// POST only, so a link or image elsewhere can't sign people out.
export async function POST(req: NextRequest) {
  const { app, domain, clientId } = config();
  const refresh = req.cookies.get(COOKIE.refresh)?.value;
  if (refresh) {
    await fetch(`${domain}/oauth2/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refresh, client_id: clientId }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {}); // the cookies go either way
  }
  const res = NextResponse.redirect(`${domain}/logout?${new URLSearchParams({ client_id: clientId, logout_uri: `${app}/` })}`, 303);
  for (const name of [COOKIE.access, COOKIE.refresh, COOKIE.team]) res.cookies.delete(name);
  return res;
}
