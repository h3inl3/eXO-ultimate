import type { FastifyInstance } from 'fastify';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { error, invite, inviteAccepted, player, playerCreate, playerUpdate } from '@exo/shared';
import { randomBytes } from 'node:crypto';
import { idParam, json } from '../openapi.ts';
import { db } from '../db/client.ts';
import { gameEvents, playerInvites, players, teamMembers } from '../db/schema.ts';
import { HttpError, isStaff, requireRole } from '../auth.ts';

const tags = ['players'];
const teamParam = json(z.object({ teamId: z.uuid() }));
const INVITE_DAYS = 14;

async function loadPlayer(id: string) {
  const [p] = await db.select().from(players).where(eq(players.id, id));
  if (!p) throw new HttpError(404, 'player not found');
  return p;
}

export async function playerRoutes(app: FastifyInstance) {
  app.get<{ Params: { teamId: string }; Querystring: { includeInactive?: string } }>(
    '/v1/teams/:teamId/players',
    {
      schema: {
        tags,
        params: teamParam,
        querystring: json(z.object({ includeInactive: z.enum(['true', 'false']).optional() })),
        response: { 200: json(z.array(player), 'output') },
      },
    },
    async (req) => {
      const role = await requireRole(req, req.params.teamId, 'player');
      const where = req.query.includeInactive === 'true'
        ? eq(players.teamId, req.params.teamId)
        : and(eq(players.teamId, req.params.teamId), eq(players.active, true));
      const rows = await db.select().from(players).where(where).orderBy(players.name);
      return isStaff(role) ? rows : rows.map((p) => ({ ...p, email: null }));
    },
  );

  app.post<{ Params: { teamId: string } }>('/v1/teams/:teamId/players', {
    schema: { tags, params: teamParam, body: json(playerCreate), response: { 201: json(player, 'output'), 404: json(error) } },
  }, async (req, reply) => {
    await requireRole(req, req.params.teamId, 'coach');
    const body = playerCreate.parse(req.body);
    const [p] = await db.insert(players).values({ ...body, teamId: req.params.teamId }).returning();
    return reply.code(201).send(p);
  });

  app.patch<{ Params: { id: string } }>('/v1/players/:id', {
    schema: { tags, params: idParam, body: json(playerUpdate), response: { 200: json(player, 'output'), 404: json(error) } },
  }, async (req) => {
    const existing = await loadPlayer(req.params.id);
    await requireRole(req, existing.teamId, 'coach');
    const body = playerUpdate.parse(req.body);
    const [p] = await db.update(players).set(body).where(eq(players.id, existing.id)).returning();
    return p;
  });

  // Soft-delete when the player has recorded stats; hard-delete otherwise.
  app.delete<{ Params: { id: string } }>('/v1/players/:id', {
    schema: {
      tags,
      params: idParam,
      response: { 200: json(z.object({ deleted: z.enum(['soft', 'hard']) }), 'output'), 404: json(error) },
    },
  }, async (req, reply) => {
    const existing = await loadPlayer(req.params.id);
    await requireRole(req, existing.teamId, 'coach');
    const [{ n } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(gameEvents)
      .where(or(eq(gameEvents.actor, existing.id), eq(gameEvents.receiver, existing.id)));
    if (n > 0) {
      await db.update(players).set({ active: false }).where(eq(players.id, existing.id));
      return reply.send({ deleted: 'soft' });
    }
    await db.delete(players).where(eq(players.id, existing.id));
    return reply.send({ deleted: 'hard' });
  });

  // shortcut: returns the code for the coach to share; emailing it comes with notifications (Phase 6).
  app.post<{ Params: { id: string } }>('/v1/players/:id/invite', {
    schema: { tags, params: idParam, response: { 201: json(invite, 'output'), 404: json(error), 409: json(error) } },
  }, async (req, reply) => {
    const p = await loadPlayer(req.params.id);
    await requireRole(req, p.teamId, 'coach');
    if (!p.active) throw new HttpError(409, 'player is inactive');
    if (p.userId) throw new HttpError(409, 'player already has an account');
    const [i] = await db
      .insert(playerInvites)
      .values({ code: randomBytes(9).toString('base64url'), playerId: p.id, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) })
      .returning();
    return reply.code(201).send({ code: i!.code, expiresAt: i!.expiresAt.toISOString() });
  });

  // Links the signed-in user to the roster spot and makes them a team member.
  app.post<{ Params: { code: string } }>('/v1/invites/:code/accept', {
    schema: {
      tags, params: json(z.object({ code: z.string().min(1).max(64) })),
      response: { 200: json(inviteAccepted, 'output'), 404: json(error), 409: json(error) },
    },
  }, async (req) => {
    return db.transaction(async (tx) => {
      // Conditional claim: of two concurrent accepts, only one gets a row back.
      const [claimed] = await tx
        .update(playerInvites)
        .set({ acceptedBy: req.userId })
        .where(and(eq(playerInvites.code, req.params.code), isNull(playerInvites.acceptedBy), gt(playerInvites.expiresAt, new Date())))
        .returning();
      if (!claimed) throw new HttpError(404, 'invite not found, used or expired');
      const [p] = await tx.select().from(players).where(eq(players.id, claimed.playerId));
      // A player deactivated after the invite went out: the old code must not get them back in.
      if (!p!.active) throw new HttpError(404, 'invite not found, used or expired');
      if (p!.userId && p!.userId !== req.userId) throw new HttpError(409, 'player already linked to another account');
      const [mine] = await tx
        .select({ id: players.id })
        .from(players)
        .where(and(eq(players.teamId, p!.teamId), eq(players.userId, req.userId)));
      if (mine && mine.id !== p!.id) throw new HttpError(409, 'you already have a roster spot on this team');
      await tx.update(players).set({ userId: req.userId }).where(eq(players.id, p!.id));
      // Do nothing on conflict: a coach who claims their player spot keeps the coach role.
      await tx.insert(teamMembers).values({ teamId: p!.teamId, userId: req.userId, role: 'player' }).onConflictDoNothing();
      return { teamId: p!.teamId, playerId: p!.id };
    });
  });
}
