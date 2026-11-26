import {
  boolean, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import type { GameEvent, RatioRule, SeasonRules } from '@exo/shared';

const ts = (name: string) => timestamp(name, { withTimezone: true });
const created = () => ts('created_at').defaultNow().notNull();

export const division = pgEnum('division', ['mixed', 'women', 'open']);
export const role = pgEnum('role', ['owner', 'coach', 'stat_keeper', 'player']);
export const genderMatch = pgEnum('gender_match', ['MMP', 'FMP']);
export const side = pgEnum('side', ['O', 'D']);
export const gameStatus = pgEnum('game_status', ['scheduled', 'live', 'final', 'cancelled']);
export const playKind = pgEnum('play_kind', ['O', 'D', 'pull', 'endzone']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  authSubject: text('auth_subject').notNull().unique(), // OIDC `sub`
  email: text('email').notNull(),
  name: text('name'),
  createdAt: created(),
});

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  division: division('division').notNull(),
  createdAt: created(),
});

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: role('role').notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);

export const players = pgTable(
  'players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    number: integer('number'),
    genderMatch: genderMatch('gender_match'),
    positions: text('positions').array().notNull().default([]),
    email: text('email'),
    active: boolean('active').notNull().default(true),
    createdAt: created(),
  },
  (t) => [index('players_team_idx').on(t.teamId)],
);

export const playerInvites = pgTable('player_invites', {
  code: text('code').primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  expiresAt: ts('expires_at').notNull(),
  acceptedBy: uuid('accepted_by').references(() => users.id),
  createdAt: created(),
});

export const seasons = pgTable('seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on'),
  rules: jsonb('rules').$type<SeasonRules>().notNull(),
  createdAt: created(),
});

export const seasonRoster = pgTable(
  'season_roster',
  {
    seasonId: uuid('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    jerseyNumber: integer('jersey_number'),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.playerId] })],
);

export const lines = pgTable('lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: side('kind').notNull(),
  playerIds: uuid('player_ids').array().notNull(),
});

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seasonId: uuid('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
    opponent: text('opponent').notNull(),
    startsAt: ts('starts_at').notNull(),
    location: text('location'),
    status: gameStatus('status').notNull().default('scheduled'),
    ratioOverride: jsonb('ratio_override').$type<RatioRule>(),
    finalUs: integer('final_us'),
    finalThem: integer('final_them'),
    /** Device currently allowed to write events (single-scorekeeper claim). */
    scorekeeperDevice: text('scorekeeper_device'),
    createdAt: created(),
  },
  (t) => [index('games_season_idx').on(t.seasonId)],
);

/** Append-only. Point rows / stats are projections of this table. */
export const gameEvents = pgTable(
  'game_events',
  {
    id: uuid('id').primaryKey(), // client-generated → idempotent uploads
    gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    type: text('type').$type<GameEvent['type']>().notNull(),
    actor: uuid('actor'),
    receiver: uuid('receiver'),
    data: jsonb('data').$type<GameEvent['data']>(),
    clientTs: ts('client_ts').notNull(),
    deviceId: text('device_id').notNull(),
    receivedAt: created(),
  },
  (t) => [uniqueIndex('game_events_game_seq_uq').on(t.gameId, t.seq)],
);

export const plays = pgTable('plays', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: playKind('kind').notNull(),
  tags: text('tags').array().notNull().default([]),
  diagram: jsonb('diagram').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: created(),
});
