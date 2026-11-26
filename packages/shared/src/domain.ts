/**
 * Core domain types. Kept dependency-free (no Zod) so the scoring engine and
 * stat engine run anywhere: Node, browsers, React Native, and `node --test`.
 */

export const DIVISIONS = ['mixed', 'women', 'open'] as const;
export type Division = (typeof DIVISIONS)[number];

export const ROLES = ['owner', 'coach', 'stat_keeper', 'player'] as const;
export type Role = (typeof ROLES)[number];

/** WFDF/USAU gender-matching designation. Only meaningful on mixed teams. */
export const GENDER_MATCHES = ['MMP', 'FMP'] as const;
export type GenderMatch = (typeof GENDER_MATCHES)[number];

export type Side = 'O' | 'D';

export const POSITIONS = ['handler', 'cutter', 'hybrid'] as const;
export type Position = (typeof POSITIONS)[number];

export type RatioRule =
  | { kind: 'none' }
  /** ABBA: `first` is the majority gender match on point 1. */
  | { kind: 'abba'; first: GenderMatch }
  /** Offense chooses the ratio each point. */
  | { kind: 'offense_choice' };

export interface SeasonRules {
  gameTo: number;
  halfAt: number;
  softCapMinutes?: number;
  hardCapMinutes?: number;
  timeoutsPerHalf: number;
  playersOnField: number;
  ratioRule: RatioRule;
}

export const DEFAULT_RULES: SeasonRules = {
  gameTo: 15,
  halfAt: 8,
  timeoutsPerHalf: 2,
  playersOnField: 7,
  ratioRule: { kind: 'none' },
};

export const EVENT_TYPES = [
  'point_start',
  'pull',
  'pickup',
  'pass',
  'goal',
  'drop',
  'throwaway',
  'stall',
  'd_block',
  'callahan',
  'opp_turnover',
  'opp_goal',
  'timeout',
  'injury_sub',
  'half',
  'end',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type PullResult = 'in' | 'out' | 'brick';

/**
 * One recorded action. `actor` is the player performing it (thrower, scorer,
 * defender, puller, player subbed off). `receiver` is the pass target, or the
 * player subbed on for `injury_sub`.
 */
export interface GameEvent {
  id: string;
  gameId: string;
  seq: number;
  type: EventType;
  actor?: string;
  receiver?: string;
  data?: {
    startOn?: Side;
    line?: string[];
    pullResult?: PullResult;
    team?: 'us' | 'them';
  };
  clientTs: string;
  deviceId: string;
}
