import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULES, type EventType, type GameEvent } from '../domain.ts';
import { abbaMajority, applyEvent, IllegalEventError, initialState, legalEvents, replay } from './machine.ts';
import { computeGameStats } from '../stats/compute.ts';

const LINE = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
let seq = 0;
function ev(type: EventType, extra: Partial<GameEvent> = {}): GameEvent {
  seq++;
  return { id: `e${seq}`, gameId: 'g1', seq, type, clientTs: new Date(0).toISOString(), deviceId: 'dev', ...extra };
}

test('receive, work it up, score: assist and hockey assist credited', () => {
  seq = 0;
  const events = [
    ev('point_start', { data: { startOn: 'O', line: LINE } }),
    ev('pickup', { actor: 'a' }),
    ev('pass', { actor: 'a', receiver: 'b' }),
    ev('pass', { actor: 'b', receiver: 'c' }),
    ev('pass', { actor: 'c', receiver: 'd' }),
    ev('goal', { actor: 'd' }),
  ];
  const s = replay(events, DEFAULT_RULES);
  assert.equal(s.us, 1);
  assert.equal(s.phase, 'between_points');
  assert.equal(s.nextStartOn, 'D');

  const st = computeGameStats(events, DEFAULT_RULES);
  assert.equal(st.players.d?.goals, 1);
  assert.equal(st.players.c?.assists, 1);
  assert.equal(st.players.b?.hockeyAssists, 1);
  assert.equal(st.team.holds, 1);
  assert.equal(st.players.a?.oPoints, 1);
});

test('pull, D, break: drop and throwaway charged correctly', () => {
  seq = 0;
  const events = [
    ev('point_start', { data: { startOn: 'D', line: LINE } }),
    ev('pull', { actor: 'g', data: { pullResult: 'in' } }),
    ev('d_block', { actor: 'e' }),
    ev('pickup', { actor: 'a' }),
    ev('pass', { actor: 'a', receiver: 'b' }),
    ev('drop', { actor: 'b' }),
    ev('opp_turnover'),
    ev('pickup', { actor: 'c' }),
    ev('throwaway', { actor: 'c' }),
    ev('d_block', { actor: 'f' }),
    ev('pickup', { actor: 'f' }),
    ev('pass', { actor: 'f', receiver: 'g' }),
    ev('goal', { actor: 'g' }),
  ];
  const st = computeGameStats(events, DEFAULT_RULES);
  assert.equal(st.final.us, 1);
  assert.equal(st.team.breaks, 1);
  assert.equal(st.team.turnovers, 2);
  assert.equal(st.players.b?.drops, 1);
  assert.equal(st.players.b?.catches, 0);
  assert.equal(st.players.a?.completions, 0);
  assert.equal(st.players.a?.throws, 1);
  assert.equal(st.players.c?.throwaways, 1);
  assert.equal(st.players.e?.ds, 1);
  assert.equal(st.players.f?.assists, 1);
  assert.equal(st.players.g?.pulls, 1);
  assert.equal(st.players.f?.plusMinus, 2);
});

test('illegal events are rejected', () => {
  seq = 0;
  const s0 = initialState();
  assert.throws(() => applyEvent(s0, ev('pass', { actor: 'a', receiver: 'b' }), DEFAULT_RULES), IllegalEventError);
  assert.throws(
    () => applyEvent(s0, ev('point_start', { data: { startOn: 'O', line: ['a', 'b'] } }), DEFAULT_RULES),
    IllegalEventError,
  );
  const s1 = applyEvent(s0, ev('point_start', { data: { startOn: 'O', line: LINE } }), DEFAULT_RULES);
  assert.deepEqual(legalEvents(s1), ['pickup', 'injury_sub', 'timeout']);
  const s2 = applyEvent(s1, ev('pickup', { actor: 'a' }), DEFAULT_RULES);
  assert.ok(!legalEvents(s2).includes('drop'), 'no drop without a prior pass');
  assert.throws(() => applyEvent(s2, ev('pass', { actor: 'b', receiver: 'c' }), DEFAULT_RULES), /holder/);
  assert.throws(() => applyEvent(s2, ev('pass', { actor: 'a', receiver: 'zz' }), DEFAULT_RULES), /not on the line/);
});

test('halftime is due at halfAt, then the opening puller receives', () => {
  seq = 0;
  const rules = { ...DEFAULT_RULES, gameTo: 5, halfAt: 3 };
  const events: GameEvent[] = [ev('point_start', { data: { startOn: 'D', line: LINE } }), ev('pull', { actor: 'a' })];
  for (let i = 0; i < 3; i++) {
    // After they score, we receive: pick up, turn it over, they score again.
    if (i > 0) events.push(ev('point_start', { data: { line: LINE } }), ev('pickup', { actor: 'a' }), ev('throwaway', { actor: 'a' }));
    events.push(ev('opp_goal'));
  }
  let s = replay(events, rules);
  assert.equal(s.them, 3);
  assert.equal(s.halftimeDue, true);
  assert.deepEqual(legalEvents(s), ['half', 'end']);
  s = applyEvent(s, ev('half'), rules);
  assert.equal(s.nextStartOn, 'O');
  assert.equal(s.phase, 'between_points');
});

test('game goes final at gameTo', () => {
  seq = 0;
  const rules = { ...DEFAULT_RULES, gameTo: 2, halfAt: 99 };
  const events = [
    ev('point_start', { data: { startOn: 'O', line: LINE } }), ev('pickup', { actor: 'a' }), ev('goal', { actor: 'a' }),
    ev('point_start', { data: { line: LINE } }), ev('pull', { actor: 'a' }), ev('callahan', { actor: 'b' }),
  ];
  const s = replay(events, rules);
  assert.equal(s.phase, 'final');
  assert.equal(s.us, 2);
  assert.deepEqual(legalEvents(s), []);
});

test('injury sub swaps the holder and credits points played', () => {
  seq = 0;
  const events = [
    ev('point_start', { data: { startOn: 'O', line: LINE } }),
    ev('pickup', { actor: 'a' }),
    ev('injury_sub', { actor: 'a', receiver: 'h' }),
    ev('pass', { actor: 'h', receiver: 'b' }),
  ];
  const s = replay(events, DEFAULT_RULES);
  assert.ok(s.line.includes('h') && !s.line.includes('a'));
  assert.equal(computeGameStats(events, DEFAULT_RULES).players.h?.pointsPlayed, 1);
});

test('ABBA ratio sequence', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((p) => abbaMajority(p, 'FMP')), ['FMP', 'MMP', 'MMP', 'FMP', 'FMP', 'MMP']);
});
