import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, eq } from 'drizzle-orm';
import type { Role } from '@exo/shared';
import { db } from './db/client.ts';
import { teamMembers } from './db/schema.ts';

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

/**
 * TODO(Phase 1): replace with OIDC JWT verification (Clerk/Auth0/Supabase),
 * mapping the token `sub` to users.auth_subject.
 */
// Health checks, the min-version check (old clients must reach it) and the API docs.
const PUBLIC = /^\/(health|v1\/meta|docs)(\/|\?|$)/;

export function registerAuth(app: FastifyInstance) {
  app.decorateRequest('userId', '');
  app.addHook('onRequest', async (req) => {
    if (PUBLIC.test(req.url)) return;
    if (process.env.DEV_AUTH === 'true') {
      const u = req.headers['x-dev-user'];
      if (typeof u === 'string' && u) {
        req.userId = u;
        return;
      }
    }
    throw new HttpError(401, 'unauthenticated');
  });
}

const RANK: Record<Role, number> = { player: 0, stat_keeper: 1, coach: 2, owner: 3 };

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
