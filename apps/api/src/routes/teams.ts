import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { error, me, member, memberAdd, memberUpdate, team, teamCreate, teamUpdate, teamWithRole, type Role } from '@exo/shared';
import { idParam, json } from '../openapi.ts';
import { db } from '../db/client.ts';
import { players, teamMembers, teams, users } from '../db/schema.ts';
import { HttpError, isStaff, requireRole } from '../auth.ts';

const memberParams = json(z.object({ id: z.uuid(), userId: z.uuid() }));
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Locks the team's owner rows and fails if `leaving` is the only one. */
async function keepAnOwner(tx: Tx, teamId: string, leaving: string) {
  const owners = await tx
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, 'owner')))
    .for('update');
  if (owners.length === 1 && owners[0]!.userId === leaving) throw new HttpError(409, 'a team needs at least one owner');
}

/** Only owners may grant the owner role or change an owner. */
function checkOwnerRule(actor: Role, ...touched: Role[]) {
  if (touched.includes('owner') && actor !== 'owner') throw new HttpError(403, 'requires owner');
}

async function memberRole(teamId: string, userId: string): Promise<Role> {
  const [m] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  if (!m) throw new HttpError(404, 'member not found');
  return m.role;
}

export async function teamRoutes(app: FastifyInstance) {
  app.get('/v1/me', { schema: { tags: ['me'], response: { 200: json(me, 'output') } } }, async (req) => {
    const [u] = await db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, req.userId));
    return u;
  });

  // Teams the current user belongs to, with their role on each (drives the team switcher).
  app.get('/v1/teams', {
    schema: { tags: ['teams'], response: { 200: json(z.array(teamWithRole), 'output') } },
  }, async (req) => {
    return db
      .select({ id: teams.id, name: teams.name, division: teams.division, role: teamMembers.role })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, req.userId));
  });

  app.post('/v1/teams', {
    schema: { tags: ['teams'], body: json(teamCreate), response: { 201: json(team, 'output') } },
  }, async (req, reply) => {
    const body = teamCreate.parse(req.body);
    const team = await db.transaction(async (tx) => {
      const [t] = await tx.insert(teams).values(body).returning();
      await tx.insert(teamMembers).values({ teamId: t!.id, userId: req.userId, role: 'owner' });
      return t!;
    });
    return reply.code(201).send(team);
  });

  app.get<{ Params: { id: string } }>('/v1/teams/:id', {
    schema: { tags: ['teams'], params: idParam, response: { 200: json(teamWithRole, 'output'), 404: json(error) } },
  }, async (req) => {
    const role = await requireRole(req, req.params.id, 'player');
    const [t] = await db.select({ id: teams.id, name: teams.name, division: teams.division }).from(teams).where(eq(teams.id, req.params.id));
    return { ...t!, role };
  });

  app.patch<{ Params: { id: string } }>('/v1/teams/:id', {
    schema: { tags: ['teams'], params: idParam, body: json(teamUpdate), response: { 200: json(team, 'output'), 404: json(error) } },
  }, async (req) => {
    await requireRole(req, req.params.id, 'coach');
    const body = teamUpdate.parse(req.body);
    if (Object.keys(body).length === 0) throw new HttpError(400, 'nothing to update');
    const [t] = await db.update(teams).set(body).where(eq(teams.id, req.params.id)).returning();
    return t;
  });

  app.get<{ Params: { id: string } }>('/v1/teams/:id/members', {
    schema: { tags: ['members'], params: idParam, response: { 200: json(z.array(member), 'output'), 404: json(error) } },
  }, async (req) => {
    const role = await requireRole(req, req.params.id, 'player');
    return db
      .select({ userId: users.id, email: isStaff(role) ? users.email : sql<null>`null`, name: users.name, role: teamMembers.role })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, req.params.id))
      .orderBy(users.email);
  });

  // shortcut: staff are added by the email they signed in with (404 until they have). Players
  // join through roster invites instead. Add emailed staff invites if coaches ask for them.
  app.post<{ Params: { id: string } }>('/v1/teams/:id/members', {
    schema: {
      tags: ['members'], params: idParam, body: json(memberAdd),
      response: { 201: json(member, 'output'), 404: json(error), 409: json(error) },
    },
  }, async (req, reply) => {
    const actor = await requireRole(req, req.params.id, 'coach');
    const body = memberAdd.parse(req.body);
    checkOwnerRule(actor, body.role);
    const [u] = await db
      .select({ userId: users.id, email: users.email, name: users.name })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${body.email})`);
    if (!u) throw new HttpError(404, 'no user with that email has signed in yet');
    const added = await db
      .insert(teamMembers)
      .values({ teamId: req.params.id, userId: u.userId, role: body.role })
      .onConflictDoNothing()
      .returning();
    if (added.length === 0) throw new HttpError(409, 'already a member');
    return reply.code(201).send({ ...u, role: body.role });
  });

  app.patch<{ Params: { id: string; userId: string } }>('/v1/teams/:id/members/:userId', {
    schema: {
      tags: ['members'], params: memberParams, body: json(memberUpdate),
      response: { 200: json(memberUpdate.extend({ userId: z.uuid() }), 'output'), 404: json(error), 409: json(error) },
    },
  }, async (req) => {
    const { id: teamId, userId } = req.params;
    const actor = await requireRole(req, teamId, 'coach');
    const { role } = memberUpdate.parse(req.body);
    const current = await memberRole(teamId, userId);
    checkOwnerRule(actor, role, current);
    await db.transaction(async (tx) => {
      if (current === 'owner' && role !== 'owner') await keepAnOwner(tx, teamId, userId);
      await tx.update(teamMembers).set({ role }).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    });
    return { userId, role };
  });

  // Coaches remove members; anyone may remove themselves (leave the team).
  app.delete<{ Params: { id: string; userId: string } }>('/v1/teams/:id/members/:userId', {
    schema: { tags: ['members'], params: memberParams, response: { 204: { type: 'null' }, 404: json(error), 409: json(error) } },
  }, async (req, reply) => {
    const { id: teamId, userId } = req.params;
    const actor = await requireRole(req, teamId, userId === req.userId ? 'player' : 'coach');
    const current = await memberRole(teamId, userId);
    if (userId !== req.userId) checkOwnerRule(actor, current);
    await db.transaction(async (tx) => {
      if (current === 'owner') await keepAnOwner(tx, teamId, userId);
      await tx.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
      // Their roster spot stays (stats reference it) but is no longer theirs.
      await tx.update(players).set({ userId: null }).where(and(eq(players.teamId, teamId), eq(players.userId, userId)));
    });
    return reply.code(204).send();
  });
}
