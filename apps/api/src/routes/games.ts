import type { FastifyInstance, FastifyRequest } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { computeGameStats, error, eventBatch, gameEvent, replay, type GameEvent, type SeasonRules } from '@exo/shared';
import { idParam, json } from '../openapi.ts';
import { db } from '../db/client.ts';
import { gameEvents, games, seasons } from '../db/schema.ts';
import { HttpError, requireRole } from '../auth.ts';

async function loadGame(id: string) {
  const [row] = await db
    .select({ game: games, teamId: seasons.teamId, rules: seasons.rules })
    .from(games)
    .innerJoin(seasons, eq(seasons.id, games.seasonId))
    .where(eq(games.id, id));
  if (!row) throw new HttpError(404, 'game not found');
  return row;
}

async function loadEvents(gameId: string): Promise<GameEvent[]> {
  const rows = await db.select().from(gameEvents).where(eq(gameEvents.gameId, gameId)).orderBy(asc(gameEvents.seq));
  return rows.map((r) => ({
    id: r.id,
    gameId: r.gameId,
    seq: r.seq,
    type: r.type,
    actor: r.actor ?? undefined,
    receiver: r.receiver ?? undefined,
    data: r.data ?? undefined,
    clientTs: r.clientTs.toISOString(),
    deviceId: r.deviceId,
  }));
}

function deviceId(req: FastifyRequest): string {
  const d = req.headers['x-device-id'];
  if (typeof d !== 'string' || !d) throw new HttpError(400, 'x-device-id header required');
  return d;
}

const tags = ['games'];
const deviceHeader = json(z.object({ 'x-device-id': z.string().min(1) }));
// shortcut: batch `state` and summary bodies are untyped in the spec; add schemas when clients consume them (Phase 3/4).
const anyObject = { type: 'object', additionalProperties: true };

export async function gameRoutes(app: FastifyInstance) {
  // Single-scorekeeper claim. `force` lets a coach take over from a lost/dead device.
  app.post<{ Params: { id: string }; Body: { force?: boolean } }>('/v1/games/:id/claim', {
    schema: {
      tags,
      params: idParam,
      headers: deviceHeader,
      body: json(z.object({ force: z.boolean().optional() })),
      response: { 200: json(z.object({ claimed: z.literal(true), deviceId: z.string() })), 409: json(error) },
    },
  }, async (req) => {
    const { game, teamId } = await loadGame(req.params.id);
    const role = await requireRole(req, teamId, 'stat_keeper');
    const device = deviceId(req);
    const takeover = req.body?.force === true && (role === 'coach' || role === 'owner');
    if (game.scorekeeperDevice && game.scorekeeperDevice !== device && !takeover) {
      throw new HttpError(409, 'game is claimed by another device');
    }
    await db.update(games).set({ scorekeeperDevice: device, status: 'live' }).where(eq(games.id, game.id));
    return { claimed: true, deviceId: device };
  });

  // Idempotent batch upload from the scorekeeper device. Re-sending events is safe.
  app.post<{ Params: { id: string } }>('/v1/games/:id/events/batch', {
    schema: {
      tags,
      params: idParam,
      headers: deviceHeader,
      body: json(eventBatch),
      response: {
        200: { type: 'object', required: ['accepted', 'duplicate', 'state'], properties: { accepted: { type: 'integer' }, duplicate: { type: 'integer' }, state: anyObject } },
        409: json(error),
      },
    },
  }, async (req) => {
    const { game, teamId, rules } = await loadGame(req.params.id);
    await requireRole(req, teamId, 'stat_keeper');
    if (game.scorekeeperDevice !== deviceId(req)) throw new HttpError(409, 'claim the game first');

    const { events } = eventBatch.parse(req.body);
    const existing = await loadEvents(game.id);
    const known = new Set(existing.map((e) => e.id));
    const fresh = events.filter((e) => !known.has(e.id) && e.gameId === game.id);

    // Validate the whole stream so the server never stores an impossible game.
    const state = replay([...existing, ...fresh], rules as SeasonRules);

    await db.transaction(async (tx) => {
      if (fresh.length) {
        await tx
          .insert(gameEvents)
          .values(fresh.map((e) => ({ ...e, clientTs: new Date(e.clientTs) })))
          .onConflictDoNothing();
      }
      if (state.phase === 'final') {
        await tx.update(games).set({ status: 'final', finalUs: state.us, finalThem: state.them }).where(eq(games.id, game.id));
      }
    });
    return { accepted: fresh.length, duplicate: events.length - fresh.length, state };
  });

  app.get<{ Params: { id: string } }>('/v1/games/:id/events', {
    schema: { tags, params: idParam, response: { 200: json(z.array(gameEvent), 'output') } },
  }, async (req) => {
    const { teamId } = await loadGame(req.params.id);
    await requireRole(req, teamId, 'player');
    return loadEvents(req.params.id);
  });

  app.get<{ Params: { id: string } }>('/v1/games/:id/summary', {
    schema: { tags, params: idParam, response: { 200: anyObject } },
  }, async (req) => {
    const { game, teamId, rules } = await loadGame(req.params.id);
    await requireRole(req, teamId, 'player');
    const events = await loadEvents(game.id);
    return { game, stats: computeGameStats(events, rules as SeasonRules) };
  });
}
