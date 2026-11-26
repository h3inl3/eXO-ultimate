/**
 * Stat engine: derives every number from the event stream, so new stats can be
 * back-filled over old games and corrections recompute automatically.
 *
 * Conventions:
 * - A `drop` turns the preceding pass into an incompletion for the thrower
 *   and charges the drop to the receiver.
 * - plusMinus = goals (incl. callahans) + assists + ds − throwaways − drops − stalls.
 */
import type { GameEvent, SeasonRules } from '../domain.ts';
import { applyEvent, initialState, type ScoringState } from '../scoring/machine.ts';

export interface PlayerLine {
  playerId: string;
  pointsPlayed: number;
  oPoints: number;
  dPoints: number;
  goals: number;
  assists: number;
  hockeyAssists: number;
  throws: number;
  completions: number;
  catches: number;
  drops: number;
  throwaways: number;
  stalls: number;
  ds: number;
  callahans: number;
  pulls: number;
  pullsOut: number;
  plusMinus: number;
}

export interface TeamLine {
  holds: number;
  holdChances: number;
  breaks: number;
  breakChances: number;
  turnovers: number;
  forcedTurnovers: number;
}

export interface GameStats {
  final: { us: number; them: number };
  players: Record<string, PlayerLine>;
  team: TeamLine;
}

function blank(playerId: string): PlayerLine {
  return {
    playerId, pointsPlayed: 0, oPoints: 0, dPoints: 0, goals: 0, assists: 0, hockeyAssists: 0,
    throws: 0, completions: 0, catches: 0, drops: 0, throwaways: 0, stalls: 0, ds: 0,
    callahans: 0, pulls: 0, pullsOut: 0, plusMinus: 0,
  };
}

export function computeGameStats(events: readonly GameEvent[], rules: SeasonRules): GameStats {
  const players: Record<string, PlayerLine> = {};
  const p = (id: string) => (players[id] ??= blank(id));
  const team: TeamLine = { holds: 0, holdChances: 0, breaks: 0, breakChances: 0, turnovers: 0, forcedTurnovers: 0 };

  let s: ScoringState = initialState();
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    const before = s;
    s = applyEvent(s, e, rules);

    switch (e.type) {
      case 'point_start':
        for (const id of s.line) {
          const pl = p(id);
          pl.pointsPlayed++;
          if (s.startOn === 'O') pl.oPoints++;
          else pl.dPoints++;
        }
        if (s.startOn === 'O') team.holdChances++;
        else team.breakChances++;
        break;
      case 'injury_sub':
        if (e.receiver) {
          const pl = p(e.receiver);
          pl.pointsPlayed++;
          if (before.startOn === 'O') pl.oPoints++;
          else pl.dPoints++;
        }
        break;
      case 'pull':
        p(e.actor!).pulls++;
        if (e.data?.pullResult === 'out') p(e.actor!).pullsOut++;
        break;
      case 'pass':
        p(e.actor!).throws++;
        p(e.actor!).completions++;
        p(e.receiver!).catches++;
        break;
      case 'goal':
        p(e.actor!).goals++;
        if (before.lastThrower) p(before.lastThrower).assists++;
        if (before.prevThrower) p(before.prevThrower).hockeyAssists++;
        if (before.startOn === 'O') team.holds++;
        else team.breaks++;
        break;
      case 'callahan':
        p(e.actor!).callahans++;
        p(e.actor!).goals++;
        if (before.startOn === 'O') team.holds++;
        else team.breaks++;
        break;
      case 'drop':
        p(e.actor!).drops++;
        p(e.actor!).catches--;
        if (before.lastThrower) p(before.lastThrower).completions--;
        team.turnovers++;
        break;
      case 'throwaway':
        p(e.actor!).throws++;
        p(e.actor!).throwaways++;
        team.turnovers++;
        break;
      case 'stall':
        p(e.actor!).stalls++;
        team.turnovers++;
        break;
      case 'd_block':
        p(e.actor!).ds++;
        team.forcedTurnovers++;
        break;
      default:
        break;
    }
  }

  for (const pl of Object.values(players)) {
    pl.plusMinus = pl.goals + pl.assists + pl.ds - pl.throwaways - pl.drops - pl.stalls;
  }
  return { final: { us: s.us, them: s.them }, players, team };
}

export function completionPct(pl: PlayerLine): number | null {
  return pl.throws === 0 ? null : pl.completions / pl.throws;
}
