import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { Role } from '@exo/shared';
import { db } from './db/client.ts';
import { teamMembers, users } from './db/schema.ts';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Health checks, the min-version check (old clients must reach it) and the API docs.
const PUBLIC = /^\/(health|v1\/meta|docs)(\/|\?|$)/;

const poolId = process.env.COGNITO_USER_POOL_ID;
/** Verifies Cognito *access* tokens (what an API should accept) from any of our app clients. */
export const cognito = poolId
  ? CognitoJwtVerifier.create({ userPoolId: poolId, tokenUse: 'access', clientId: (process.env.COGNITO_CLIENT_IDS ?? '').split(',') })
  : undefined;

type Profile = { email: string; name?: string };

/** Access tokens carry no email, so fetch it once, when we first see a user. */
async function cognitoProfile(token: string, sub: string): Promise<Profile> {
  const res = await fetch(`${process.env.COGNITO_DOMAIN}/oauth2/userInfo`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new HttpError(401, 'userinfo failed');
  const u = (await res.json()) as { sub: string; email?: string; email_verified?: boolean | string; name?: string };
  if (u.sub !== sub || !u.email) throw new HttpError(401, 'userinfo: no email (request the openid and email scopes)');
  // Staff are added by email, so an unverified address would let someone take another person's place.
  if (String(u.email_verified) !== 'true') throw new HttpError(401, 'email not verified');
  return { email: u.email, name: u.name };
}

/** Maps an auth subject to our users.id, creating the user on first sight. */
async function userIdFor(subject: string, profile: () => Promise<Profile>): Promise<string> {
  const find = () => db.select({ id: users.id }).from(users).where(eq(users.authSubject, subject));
  const [u] = await find();
  if (u) return u.id;
  // on conflict: two first requests can race; both then read the one row.
  await db.insert(users).values({ authSubject: subject, ...(await profile()) }).onConflictDoNothing({ target: users.authSubject });
  const [created] = await find();
  return created!.id;
}

export function registerAuth(app: FastifyInstance) {
  const devAuth = process.env.DEV_AUTH === 'true';
  if (devAuth && process.env.NODE_ENV === 'production') throw new Error('DEV_AUTH must not be enabled in production');
  if (cognito && !(process.env.COGNITO_DOMAIN && process.env.COGNITO_CLIENT_IDS)) {
    throw new Error('COGNITO_USER_POOL_ID needs COGNITO_DOMAIN and COGNITO_CLIENT_IDS');
  }
  app.decorateRequest('userId', '');
  app.addHook('onRequest', async (req) => {
    if (PUBLIC.test(req.url)) return;
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (bearer && cognito) {
      const claims = await cognito.verify(bearer).catch(() => {
        throw new HttpError(401, 'invalid token');
      });
      req.userId = await userIdFor(claims.sub, () => cognitoProfile(bearer, claims.sub));
      return;
    }
    // Dev/test only: `x-dev-user: <any subject>` signs in as that subject.
    const dev = req.headers['x-dev-user'];
    if (devAuth && typeof dev === 'string' && dev) {
      req.userId = await userIdFor(`dev|${dev}`, async () => ({ email: `${dev}@dev.local`, name: dev }));
      return;
    }
    throw new HttpError(401, 'unauthenticated');
  });
}

const RANK: Record<Role, number> = { player: 0, stat_keeper: 1, coach: 2, owner: 3 };

/** Coaches and owners; only they see members' contact details. */
export const isStaff = (role: Role) => RANK[role] >= RANK.coach;

/** Throws 403 unless the user is on the team with at least `min` role. */
export async function requireRole(req: FastifyRequest, teamId: string, min: Role): Promise<Role> {
  const [m] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, req.userId)));
  if (!m) throw new HttpError(404, 'team not found');
  if (RANK[m.role] < RANK[min]) throw new HttpError(403, `requires ${min}`);
  return m.role;
}
