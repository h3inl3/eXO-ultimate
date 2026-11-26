/**
 * Phase 1 scoring prototype: local-only, no backend, built on the shared
 * state machine. Purpose: field-test the radial-menu interaction at practice.
 *
 * Offense: the disc holder's radial is always open; tapping a teammate = pass.
 * Defense: tap a player for D / Callahan; Opp turnover / Opp scores buttons.
 * Loose disc (after receive, D or opp turnover): tap whoever picks it up.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import {
  applyEvent, DEFAULT_RULES, IllegalEventError, legalEvents, replay,
  type EventType, type GameEvent, type Side,
} from '@exo/shared';

const ROSTER = [
  { id: 'p1', name: 'Jo' }, { id: 'p2', name: 'Sam' }, { id: 'p3', name: 'Alex' }, { id: 'p4', name: 'Ria' },
  { id: 'p5', name: 'Kai' }, { id: 'p6', name: 'Mei' }, { id: 'p7', name: 'Dev' },
];
const LINE = ROSTER.map((p) => p.id); // TODO: line builder
const NAME: Record<string, string> = Object.fromEntries(ROSTER.map((p) => [p.id, p.name]));
/** Fixed on-screen spots (normalized) so the scorer builds muscle memory. */
const SPOTS: Array<[number, number]> = [
  [0.22, 0.28], [0.5, 0.2], [0.78, 0.28], [0.18, 0.72], [0.4, 0.62], [0.62, 0.72], [0.84, 0.64],
];
const TOKEN = 64;
const R = 78;

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type RadialOption = { label: string; type: EventType; dx: number; dy: number; color: string };

function describe(e: GameEvent): string {
  const n = (id?: string) => (id ? NAME[id] ?? id : '?');
  switch (e.type) {
    case 'point_start': return `Point start (${e.data?.startOn ?? 'next'})`;
    case 'pass': return `${n(e.actor)} → ${n(e.receiver)}`;
    case 'pickup': return `Pickup ${n(e.actor)}`;
    case 'pull': return `Pull (${n(e.actor)}) ${e.data?.pullResult ?? ''}`;
    case 'goal': return `GOAL ${n(e.actor)}`;
    case 'd_block': return `D ${n(e.actor)}`;
    case 'opp_goal': return 'Opponent scores';
    case 'opp_turnover': return 'Opponent turnover';
    default: return `${e.type.replace('_', ' ')}${e.actor ? ` ${n(e.actor)}` : ''}`;
  }
}

export default function ScoreScreen() {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dSelected, setDSelected] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const state = useMemo(() => replay(events, DEFAULT_RULES), [events]);
  const legal = legalEvents(state);

  function record(type: EventType, extra: Partial<GameEvent> = {}) {
    const e: GameEvent = {
      id: newId(), gameId: 'prototype', seq: events.length, type,
      clientTs: new Date().toISOString(), deviceId: 'prototype', ...extra,
    };
    try {
      applyEvent(state, e, DEFAULT_RULES);
      setEvents([...events, e]);
      setError(null);
      setDSelected(null);
    } catch (err) {
      setError(err instanceof IllegalEventError ? err.message : String(err));
    }
  }

  function tapPlayer(id: string) {
    if (state.phase === 'pulling') return record('pull', { actor: id, data: { pullResult: 'in' } });
    if (state.phase === 'offense') {
      if (state.holder === null) return record('pickup', { actor: id });
      if (state.holder !== id) return record('pass', { actor: state.holder, receiver: id });
      return;
    }
    if (state.phase === 'defense') setDSelected(dSelected === id ? null : id);
  }

  const startPoint = (startOn?: Side) =>
    record('point_start', { data: { line: LINE, ...(startOn ? { startOn } : {}) } });

  // Radial menu around the holder (offense) or the selected defender.
  const radialFor = state.phase === 'offense' ? state.holder : state.phase === 'defense' ? dSelected : null;
  const radial: RadialOption[] =
    state.phase === 'offense'
      ? [
          { label: 'Throwaway', type: 'throwaway', dx: 0, dy: -R, color: '#d1242f' },
          { label: 'Goal', type: 'goal', dx: R, dy: 0, color: '#1a7f37' },
          { label: 'Drop', type: 'drop', dx: 0, dy: R, color: '#d1242f' },
          { label: 'Timeout', type: 'timeout', dx: -R, dy: 0, color: '#6e7781' },
          { label: 'Stall', type: 'stall', dx: -R * 0.75, dy: R * 0.75, color: '#bc4c00' },
        ]
      : [
          { label: 'D', type: 'd_block', dx: 0, dy: -R, color: '#1a7f37' },
          { label: 'Callahan', type: 'callahan', dx: R, dy: 0, color: '#8250df' },
        ];

  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const spot = (id: string) => {
    const [x, y] = SPOTS[LINE.indexOf(id)] ?? [0.5, 0.5];
    return { left: x * size.w, top: y * size.h };
  };

  const phaseLabel =
    state.phase === 'offense' ? (state.holder ? 'OFFENSE' : 'OFFENSE · tap who picks up')
    : state.phase === 'defense' ? 'DEFENSE'
    : state.phase === 'pulling' ? 'PULL · tap the puller'
    : state.phase === 'final' ? 'FINAL' : 'BETWEEN POINTS';

  return (
    <View style={{ flex: 1, backgroundColor: '#f6f8fa' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, backgroundColor: '#0d1117' }}>
        <Text style={{ color: 'white', fontSize: 22, fontWeight: '700' }}>US {state.us} – {state.them} THEM</Text>
        <Text style={{ color: '#8b949e', flex: 1 }}>Pt {state.point} · {phaseLabel}</Text>
        <Pressable
          disabled={events.length === 0}
          onPress={() => { setEvents(events.slice(0, -1)); setError(null); setDSelected(null); }}
          style={{ backgroundColor: '#30363d', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, opacity: events.length ? 1 : 0.4 }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>UNDO</Text>
        </Pressable>
      </View>

      {/* Field */}
      <View style={{ flex: 1, margin: 12, borderRadius: 16, backgroundColor: '#2da44e22' }} onLayout={onLayout}>
        {(state.phase !== 'between_points' && state.phase !== 'final') && size.w > 0 && LINE.map((id) => {
          const pos = spot(id);
          const isHolder = state.holder === id;
          const isSel = dSelected === id;
          return (
            <Pressable
              key={id}
              onPress={() => tapPlayer(id)}
              style={{
                position: 'absolute', left: pos.left - TOKEN / 2, top: pos.top - TOKEN / 2,
                width: TOKEN, height: TOKEN, borderRadius: TOKEN / 2,
                backgroundColor: isHolder ? '#1f6feb' : isSel ? '#8250df' : 'white',
                borderWidth: 2, borderColor: '#0d1117', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: isHolder || isSel ? 'white' : '#0d1117' }}>
                {NAME[id]}{isHolder ? ' •' : ''}
              </Text>
            </Pressable>
          );
        })}

        {radialFor && size.w > 0 && radial.filter((o) => legal.includes(o.type)).map((o) => {
          const pos = spot(radialFor);
          return (
            <Pressable
              key={o.type}
              onPress={() => record(o.type, o.type === 'timeout' ? { data: { team: 'us' } } : { actor: radialFor })}
              style={{
                position: 'absolute', left: pos.left + o.dx - 44, top: pos.top + o.dy - 20,
                width: 88, height: 40, borderRadius: 20, backgroundColor: o.color,
                alignItems: 'center', justifyContent: 'center', zIndex: 10,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>{o.label}</Text>
            </Pressable>
          );
        })}

        {state.phase === 'between_points' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {state.halftimeDue ? (
              <Btn label="Halftime" onPress={() => record('half')} />
            ) : state.nextStartOn === null ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Btn label="Start on O (receive)" onPress={() => startPoint('O')} />
                <Btn label="Start on D (pull)" onPress={() => startPoint('D')} />
              </View>
            ) : (
              <Btn label={`Start point ${state.point} on ${state.nextStartOn}`} onPress={() => startPoint()} />
            )}
          </View>
        )}
        {state.phase === 'final' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 32, fontWeight: '800' }}>Final {state.us}–{state.them}</Text>
          </View>
        )}
      </View>

      {/* Bottom bar */}
      {state.phase === 'defense' && (
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 12 }}>
          <Btn grow label="Opp turnover" onPress={() => record('opp_turnover')} />
          <Btn grow label="Opp scores" color="#d1242f" onPress={() => record('opp_goal')} />
        </View>
      )}
      {error && <Text style={{ color: '#d1242f', paddingHorizontal: 12, paddingTop: 8 }}>{error}</Text>}
      <ScrollView horizontal style={{ maxHeight: 44, padding: 12 }}>
        <Text style={{ color: '#57606a' }}>Last: {events.slice(-3).reverse().map(describe).join('  ·  ') || '—'}</Text>
      </ScrollView>
    </View>
  );
}

function Btn({ label, onPress, color = '#1f6feb', grow = false }: { label: string; onPress: () => void; color?: string; grow?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ flex: grow ? 1 : undefined, backgroundColor: color, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' }}>
      <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
