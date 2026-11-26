/** Zod schemas for API payloads, shared by the API (validation) and clients (forms). */
import { z } from 'zod';
import { DIVISIONS, EVENT_TYPES, GENDER_MATCHES, POSITIONS, ROLES } from './domain.ts';

export const id = z.uuid();

export const teamCreate = z.object({
  name: z.string().trim().min(1).max(80),
  division: z.enum(DIVISIONS),
});
export type TeamCreate = z.infer<typeof teamCreate>;

export const memberRole = z.enum(ROLES);

export const playerCreate = z.object({
  name: z.string().trim().min(1).max(80),
  number: z.int().min(0).max(99).optional(),
  genderMatch: z.enum(GENDER_MATCHES).nullable().default(null),
  positions: z.array(z.enum(POSITIONS)).default([]),
  email: z.email().optional(),
});
export const playerUpdate = playerCreate.partial().extend({ active: z.boolean().optional() });
export type PlayerCreate = z.infer<typeof playerCreate>;

const ratioRule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('abba'), first: z.enum(GENDER_MATCHES) }),
  z.object({ kind: z.literal('offense_choice') }),
]);

export const seasonRules = z.object({
  gameTo: z.int().min(1).max(50).default(15),
  halfAt: z.int().min(1).max(25).default(8),
  softCapMinutes: z.int().positive().optional(),
  hardCapMinutes: z.int().positive().optional(),
  timeoutsPerHalf: z.int().min(0).max(5).default(2),
  playersOnField: z.int().min(4).max(7).default(7),
  ratioRule: ratioRule.default({ kind: 'none' }),
});

export const seasonCreate = z.object({
  name: z.string().trim().min(1).max(80),
  startsOn: z.iso.date(),
  endsOn: z.iso.date().optional(),
  rules: seasonRules.default(seasonRules.parse({})),
});

export const gameCreate = z.object({
  opponent: z.string().trim().min(1).max(80),
  startsAt: z.iso.datetime({ offset: true }),
  location: z.string().max(200).optional(),
});

export const gameEvent = z.object({
  id,
  gameId: id,
  seq: z.int().nonnegative(),
  type: z.enum(EVENT_TYPES),
  actor: id.optional(),
  receiver: id.optional(),
  data: z
    .object({
      startOn: z.enum(['O', 'D']).optional(),
      line: z.array(id).optional(),
      pullResult: z.enum(['in', 'out', 'brick']).optional(),
      team: z.enum(['us', 'them']).optional(),
    })
    .optional(),
  clientTs: z.iso.datetime({ offset: true }),
  deviceId: z.string().min(1).max(100),
});

export const eventBatch = z.object({ events: z.array(gameEvent).min(1).max(500) });

export const playSave = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['O', 'D', 'pull', 'endzone']),
  tags: z.array(z.string().max(30)).max(20).default([]),
  diagram: z.unknown(), // validated structurally by plays/diagram.ts
  version: z.int().nonnegative().optional(),
});
