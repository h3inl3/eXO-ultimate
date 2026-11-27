// Integration tests against the real Postgres in DATABASE_URL (`pnpm db:up` locally, a service in CI).
import { after, before, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';

const POOL = 'us-east-2_TestPool';
process.env.DEV_AUTH = 'true';
process.env.COGNITO_USER_POOL_ID = POOL;
process.env.COGNITO_CLIENT_IDS = 'web-client,mobile-client';
process.env.COGNITO_DOMAIN = 'https://auth.example.test';

const { buildApp } = await import('./app.ts');
const { cognito } = await import('./auth.ts');
const { db, sql } = await import('./db/client.ts');
const { users } = await import('./db/schema.ts');
const { migrateWithLock } = await import('./db/migrate.ts');

const app = buildApp();
const run = randomUUID().slice(0, 8); // unique names, so reruns never collide with old rows
const u = (name: string) => `${name}-${run}`;

async function call(user: string | null, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: object) {
  const res = await app.inject({ method, url, payload: body, headers: user ? { 'x-dev-user': u(user) } : {} });
  return { status: res.statusCode, body: res.body ? res.json() : undefined };
}
const meId = async (user: string) => (await call(user, 'GET', '/v1/me')).body.id as string;

before(async () => {
  await migrateWithLock();
  await app.ready();
});
after(async () => {
  await app.close();
  await sql.end();
});

test('auth: public routes open, everything else needs a user', async () => {
  assert.equal((await call(null, 'GET', '/health')).status, 200);
  assert.equal((await call(null, 'GET', '/v1/teams')).status, 401);
  const me = await call('alice', 'GET', '/v1/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.email, `${u('alice')}@dev.local`);
  assert.equal(await meId('alice'), me.body.id, 'same subject maps to the same user');
});

describe('members', () => {
  let team: string;
  before(async () => {
    team = (await call('owner', 'POST', '/v1/teams', { name: 'Disc Doctors', division: 'mixed' })).body.id;
    await meId('coach'); // users must have signed in once to be added by email
    await meId('keeper');
  });
  const add = (as: string, who: string, role: string) =>
    call(as, 'POST', `/v1/teams/${team}/members`, { email: `${u(who)}@dev.local`, role });

  test('owner adds staff by email; unknown and duplicate emails fail', async () => {
    assert.equal((await add('owner', 'coach', 'coach')).status, 201);
    assert.equal((await add('owner', 'coach', 'coach')).status, 409);
    assert.equal((await add('owner', 'nobody', 'coach')).status, 404);
    const list = await call('coach', 'GET', `/v1/teams/${team}/members`);
    assert.deepEqual(list.body.map((m: { role: string }) => m.role).sort(), ['coach', 'owner']);
  });

  test('coach cannot grant or touch owner; non-members see 404', async () => {
    assert.equal((await add('coach', 'keeper', 'owner')).status, 403);
    assert.equal((await add('coach', 'keeper', 'stat_keeper')).status, 201);
    const ownerId = await meId('owner');
    assert.equal((await call('coach', 'PATCH', `/v1/teams/${team}/members/${ownerId}`, { role: 'player' })).status, 403);
    assert.equal((await call('coach', 'DELETE', `/v1/teams/${team}/members/${ownerId}`)).status, 403);
    assert.equal((await call('keeper', 'PATCH', `/v1/teams/${team}`, { name: 'x' })).status, 403);
    assert.equal((await call('stranger', 'GET', `/v1/teams/${team}`)).status, 404);
  });

  test('the last owner can neither be demoted nor leave', async () => {
    const ownerId = await meId('owner');
    assert.equal((await call('owner', 'PATCH', `/v1/teams/${team}/members/${ownerId}`, { role: 'coach' })).status, 409);
    assert.equal((await call('owner', 'DELETE', `/v1/teams/${team}/members/${ownerId}`)).status, 409);
    const coachId = await meId('coach');
    assert.equal((await call('owner', 'PATCH', `/v1/teams/${team}/members/${coachId}`, { role: 'owner' })).status, 200);
    assert.equal((await call('owner', 'DELETE', `/v1/teams/${team}/members/${ownerId}`)).status, 204, 'leaving is fine once another owner exists');
  });

  test('anyone can leave', async () => {
    assert.equal((await call('keeper', 'DELETE', `/v1/teams/${team}/members/${await meId('keeper')}`)).status, 204);
    assert.equal((await call('keeper', 'GET', `/v1/teams/${team}`)).status, 404);
  });
});

describe('player invites', () => {
  let team: string;
  const newPlayer = async (name: string) =>
    (await call('icoach', 'POST', `/v1/teams/${team}/players`, { name })).body.id as string;
  const invite = async (playerId: string) => (await call('icoach', 'POST', `/v1/players/${playerId}/invite`)).body.code as string;

  before(async () => {
    team = (await call('icoach', 'POST', '/v1/teams', { name: 'Huckers', division: 'open' })).body.id;
  });

  test('accepting links the roster spot and grants read-only membership', async () => {
    const pid = await newPlayer('Jo');
    const code = await invite(pid);
    const acc = await call('jo', 'POST', `/v1/invites/${code}/accept`);
    assert.equal(acc.status, 200);
    assert.deepEqual(acc.body, { teamId: team, playerId: pid });
    assert.equal((await call('jo', 'GET', `/v1/teams/${team}`)).body.role, 'player');
    assert.equal((await call('jo', 'POST', `/v1/teams/${team}/players`, { name: 'x' })).status, 403);
    const roster = await call('jo', 'GET', `/v1/teams/${team}/players`);
    assert.equal(roster.body.find((p: { id: string }) => p.id === pid).userId, await meId('jo'));
  });

  test('a code works once, and linked players cannot be re-invited', async () => {
    const pid = await newPlayer('Sam');
    const code = await invite(pid);
    const results = await Promise.all([call('sam', 'POST', `/v1/invites/${code}/accept`), call('eve', 'POST', `/v1/invites/${code}/accept`)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 404]);
    assert.equal((await call('icoach', 'POST', `/v1/players/${pid}/invite`)).status, 409);
  });

  test('one roster spot per user per team', async () => {
    const code = await invite(await newPlayer('Kai'));
    assert.equal((await call('jo', 'POST', `/v1/invites/${code}/accept`)).status, 409);
  });

  test('staff claiming a player spot keep their role', async () => {
    const code = await invite(await newPlayer('Coach Mei'));
    assert.equal((await call('icoach', 'POST', `/v1/invites/${code}/accept`)).status, 200);
    assert.equal((await call('icoach', 'GET', `/v1/teams/${team}`)).body.role, 'owner');
  });

  test('removing a member unlinks their roster spot', async () => {
    const pid = await newPlayer('Ria');
    await call('ria', 'POST', `/v1/invites/${await invite(pid)}/accept`);
    assert.equal((await call('icoach', 'DELETE', `/v1/teams/${team}/members/${await meId('ria')}`)).status, 204);
    const roster = await call('icoach', 'GET', `/v1/teams/${team}/players`);
    assert.equal(roster.body.find((p: { id: string }) => p.id === pid).userId, null);
  });
});

describe('cognito tokens', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = (claims: object) => {
    const body = `${b64({ alg: 'RS256', kid })}.${b64(claims)}`;
    return `${body}.${createSign('RSA-SHA256').update(body).sign(privateKey).toString('base64url')}`;
  };
  const now = Math.floor(Date.now() / 1000);
  const sub = randomUUID();
  const claims = {
    sub, iss: `https://cognito-idp.us-east-2.amazonaws.com/${POOL}`, client_id: 'mobile-client',
    token_use: 'access', scope: 'openid email', iat: now, exp: now + 600,
  };
  const get = (t: string) => app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${t}` } });

  before(async () => {
    cognito!.cacheJwks({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }] } as never);
    // Pre-created, so the first request doesn't call Cognito's /oauth2/userInfo.
    await db.insert(users).values({ authSubject: sub, email: `${sub}@example.com` });
  });

  test('a valid access token signs the user in', async () => {
    const res = await get(token(claims));
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().email, `${sub}@example.com`);
  });

  test('ID tokens, foreign clients and expired tokens are rejected', async () => {
    assert.equal((await get(token({ ...claims, token_use: 'id' }))).statusCode, 401);
    assert.equal((await get(token({ ...claims, client_id: 'someone-else' }))).statusCode, 401);
    assert.equal((await get(token({ ...claims, exp: now - 10 }))).statusCode, 401);
    assert.equal((await get('not.a.jwt')).statusCode, 401);
  });

  test('first sight fetches the profile and requires a verified email', async () => {
    const userInfo = (body: object) =>
      mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(body), { status: 200 }));
    const fresh = () => ({ ...claims, sub: randomUUID() });

    const c1 = fresh();
    userInfo({ sub: c1.sub, email: `${c1.sub}@example.com`, email_verified: 'true' });
    const ok = await get(token(c1));
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.json().email, `${c1.sub}@example.com`);

    const c2 = fresh();
    userInfo({ sub: c2.sub, email: 'victim@example.com', email_verified: false });
    assert.equal((await get(token(c2))).statusCode, 401);

    const c3 = fresh();
    userInfo({ sub: randomUUID(), email: 'x@example.com', email_verified: true });
    assert.equal((await get(token(c3))).statusCode, 401, 'userInfo for a different subject');
    mock.restoreAll();
  });
});
