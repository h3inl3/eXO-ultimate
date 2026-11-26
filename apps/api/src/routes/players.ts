import type { FastifyInstance } from 'fastify';
import { and, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { error, player, playerCreate, playerUpdate } from '@exo/shared';
import { idParam, json } from '../openapi.ts';

const tags = ['players'];
const teamParam = json(z.object({ teamId: z.uuid() }));
import { db } from '../db/client.ts';
import { gameEvents, players } from '../db/schema.ts';
import { HttpError, requireRole } from '../auth.ts';

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
      await requireRole(req, req.params.teamId, 'player');
      const where = req.query.includeInactive === 'true'
        ? eq(players.teamId, req.params.teamId)
        : and(eq(players.teamId, req.params.teamId), eq(players.active, true));
      return db.select().from(players).where(where).orderBy(players.name);
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
}
