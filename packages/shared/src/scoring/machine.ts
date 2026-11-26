/**
 * Scoring state machine. Pure and deterministic: the game state is always
 * `replay(events)`, so undo = drop the last event and replay.
 *
 *   between_points ─point_start(D)→ pulling ─pull→ defense
 *   between_points ─point_start(O)→ offense (holder = null: tap who picks up)
 *   offense: pickup / pass / goal / drop / throwaway / stall
 *   defense: d_block / opp_turnover → offense(holder=null); callahan; opp_goal
 *   goal | callahan | opp_goal → between_points (or final at gameTo)
 */
import type { EventType, GameEvent, SeasonRules, Side } from '../domain.ts';

export type Phase = 'between_points' | 'pulling' | 'offense' | 'defense' | 'final';

export interface ScoringState {
  phase: Phase;
  /** Number of the current (or next, when between points) point, 1-based. */
  point: number;
  us: number;
  them: number;
  line: string[];
  startOn: Side | null;
  /** Side we start the next point on. null until the first point is started. */
  nextStartOn: Side | null;
  firstStartOn: Side | null;
  holder: string | null;
  /** Thrower of the pass that put the disc in `holder`'s hands (assist candidate). */
  lastThrower: string | null;
  /** Thrower before that (hockey-assist candidate). */
  prevThrower: string | null;
  halfPlayed: boolean;
  /** True when a team has reached `halfAt` and half hasn't been taken yet. */
  halftimeDue: boolean;
  timeoutsUsed: { us: number; them: number };
}

export class IllegalEventError extends Error {
  readonly event: GameEvent;
  readonly state: ScoringState;
  constructor(message: string, event: GameEvent, state: ScoringState) {
    super(message);
    this.name = 'IllegalEventError';
    this.event = event;
    this.state = state;
  }
}

export function initialState(): ScoringState {
  return {
    phase: 'between_points',
    point: 1,
    us: 0,
    them: 0,
    line: [],
    startOn: null,
    nextStartOn: null,
    firstStartOn: null,
    holder: null,
    lastThrower: null,
    prevThrower: null,
    halfPlayed: false,
    halftimeDue: false,
    timeoutsUsed: { us: 0, them: 0 },
  };
}

/** Event types the UI should offer in the current state. */
export function legalEvents(s: ScoringState): EventType[] {
  switch (s.phase) {
    case 'between_points':
      return s.halftimeDue
        ? ['half', 'end']
        : ['point_start', 'timeout', 'end'];
    case 'pulling':
      return ['pull', 'injury_sub', 'timeout'];
    case 'offense':
      return s.holder === null
        ? ['pickup', 'injury_sub', 'timeout']
        : [
            'pass',
            'goal',
            ...(s.lastThrower ? (['drop'] as const) : []),
            'throwaway',
            'stall',
            'injury_sub',
            'timeout',
          ];
    case 'defense':
      return ['d_block', 'callahan', 'opp_turnover', 'opp_goal', 'injury_sub', 'timeout'];
    case 'final':
      return [];
  }
}

function scored(s: ScoringState, by: 'us' | 'them', rules: SeasonRules): ScoringState {
  const us = s.us + (by === 'us' ? 1 : 0);
  const them = s.them + (by === 'them' ? 1 : 0);
  const reachedGameTo = us >= rules.gameTo || them >= rules.gameTo;
  const halftimeDue = !s.halfPlayed && !reachedGameTo && (us >= rules.halfAt || them >= rules.halfAt);
  return {
    ...s,
    us,
    them,
    phase: reachedGameTo ? 'final' : 'between_points',
    point: s.point + 1,
    // The team that scores pulls next.
    nextStartOn: by === 'us' ? 'D' : 'O',
    halftimeDue,
    holder: null,
    lastThrower: null,
    prevThrower: null,
  };
}

function turnover(s: ScoringState): ScoringState {
  return { ...s, phase: 'defense', holder: null, lastThrower: null, prevThrower: null };
}

function gainPossession(s: ScoringState): ScoringState {
  return { ...s, phase: 'offense', holder: null, lastThrower: null, prevThrower: null };
}

function requireOnLine(s: ScoringState, e: GameEvent, playerId: string | undefined): string {
  if (!playerId || !s.line.includes(playerId)) {
    throw new IllegalEventError(`${e.type}: player ${playerId ?? '(none)'} is not on the line`, e, s);
  }
  return playerId;
}

export function applyEvent(s: ScoringState, e: GameEvent, rules: SeasonRules): ScoringState {
  if (!legalEvents(s).includes(e.type)) {
    throw new IllegalEventError(`${e.type} is not legal during ${s.phase}`, e, s);
  }

  switch (e.type) {
    case 'point_start': {
      const startOn = e.data?.startOn ?? s.nextStartOn;
      const line = e.data?.line ?? [];
      if (!startOn) throw new IllegalEventError('point_start needs data.startOn for the first point', e, s);
      if (line.length !== rules.playersOnField || new Set(line).size !== line.length) {
        throw new IllegalEventError(`line must have ${rules.playersOnField} distinct players`, e, s);
      }
      return {
        ...s,
        phase: startOn === 'D' ? 'pulling' : 'offense',
        line,
        startOn,
        firstStartOn: s.firstStartOn ?? startOn,
        holder: null,
        lastThrower: null,
        prevThrower: null,
      };
    }
    case 'pull':
      requireOnLine(s, e, e.actor);
      return { ...s, phase: 'defense' };
    case 'pickup':
      return { ...s, holder: requireOnLine(s, e, e.actor), lastThrower: null, prevThrower: null };
    case 'pass': {
      if (e.actor !== s.holder) throw new IllegalEventError('pass must be thrown by the holder', e, s);
      const receiver = requireOnLine(s, e, e.receiver);
      if (receiver === s.holder) throw new IllegalEventError('cannot pass to self', e, s);
      return { ...s, holder: receiver, prevThrower: s.lastThrower, lastThrower: s.holder };
    }
    case 'goal':
      if (e.actor !== s.holder) throw new IllegalEventError('goal must be scored by the holder', e, s);
      return scored(s, 'us', rules);
    case 'drop':
    case 'throwaway':
    case 'stall':
      if (e.actor !== s.holder) throw new IllegalEventError(`${e.type} must be by the holder`, e, s);
      return turnover(s);
    case 'd_block':
      requireOnLine(s, e, e.actor);
      return gainPossession(s);
    case 'callahan':
      requireOnLine(s, e, e.actor);
      return scored(s, 'us', rules);
    case 'opp_turnover':
      return gainPossession(s);
    case 'opp_goal':
      return scored(s, 'them', rules);
    case 'timeout': {
      const team = e.data?.team ?? 'us';
      return { ...s, timeoutsUsed: { ...s.timeoutsUsed, [team]: s.timeoutsUsed[team] + 1 } };
    }
    case 'injury_sub': {
      const out = requireOnLine(s, e, e.actor);
      const incoming = e.receiver;
      if (!incoming || s.line.includes(incoming)) {
        throw new IllegalEventError('injury_sub needs a receiver who is not on the line', e, s);
      }
      const swap = (p: string | null) => (p === out ? incoming : p);
      return {
        ...s,
        line: s.line.map((p) => (p === out ? incoming : p)),
        holder: swap(s.holder),
        lastThrower: swap(s.lastThrower),
        prevThrower: swap(s.prevThrower),
      };
    }
    case 'half':
      return {
        ...s,
        halfPlayed: true,
        halftimeDue: false,
        timeoutsUsed: { us: 0, them: 0 },
        // Whoever started on D (pulled) to open the game receives after half.
        nextStartOn: s.firstStartOn === 'D' ? 'O' : 'D',
      };
    case 'end':
      return { ...s, phase: 'final' };
  }
}

/** Rebuild state from an ordered event list. Events are sorted by `seq`. */
export function replay(events: readonly GameEvent[], rules: SeasonRules): ScoringState {
  return [...events].sort((a, b) => a.seq - b.seq).reduce((s, e) => applyEvent(s, e, rules), initialState());
}

/** Majority gender match required on a given point under an ABBA rule (1-based point). */
export function abbaMajority(point: number, first: 'MMP' | 'FMP'): 'MMP' | 'FMP' {
  const other: 'MMP' | 'FMP' = first === 'MMP' ? 'FMP' : 'MMP';
  // A B B A A B B A ...
  return [first, other, other, first][(point - 1) % 4] ?? first;
}
