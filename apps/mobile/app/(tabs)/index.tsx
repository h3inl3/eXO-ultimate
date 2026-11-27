import { Ionicons } from '@expo/vector-icons';
import { Link, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, Text, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HERO_ORANGE, ON_ORANGE, SAMPLE, resultChip } from '@exo/shared';
import { useTheme } from '../../src/theme';
import { useSession } from '../../src/session';

type Icon = ComponentProps<typeof Ionicons>['name'];
const display: TextStyle = { fontWeight: '700', fontVariant: ['tabular-nums'] };

// Team home (docs/design/MobileHome.dc.html). Game data stays SAMPLE until seasons and games land (Phase 2-3).
export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { team, teams, me, setTeam, signOut } = useSession();
  const { live, schedule } = SAMPLE;
  const role = { owner: 'Owner', coach: 'Coach', stat_keeper: 'Stat keeper', player: 'Player' }[team!.role];
  const division = team!.division[0]!.toUpperCase() + team!.division.slice(1);
  const switchTeam = () =>
    Alert.alert('Switch team', undefined, [
      ...teams.map((x) => ({ text: x.id === team!.id ? `✓ ${x.name}` : x.name, onPress: () => setTeam(x.id) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  const account = () =>
    Alert.alert(me!.name ?? 'Account', me!.email, [
      { text: 'Sign out', style: 'destructive', onPress: signOut },
      { text: 'Cancel', style: 'cancel' },
    ]);
  const actions: Array<[string, Icon, string, string, Href]> = [
    ['Add player', 'person-add-outline', t.chipBlue, t.link, '/roster'],
    ['New game', 'disc-outline', t.orange, ON_ORANGE, '/score'],
    ['Season', 'calendar-outline', t.chipGreen, t.green, '/games'],
    ['New play', 'create-outline', t.surface2, t.text, '/playbook'],
  ];
  const card = { backgroundColor: t.surface, borderColor: t.line, borderWidth: 1 } as const;

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, padding: 20, gap: 20 }}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch team"
          onPress={switchTeam}
          style={{
            ...card,
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: 48,
            padding: 6,
            paddingRight: 12,
            borderRadius: 14,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: t.blue,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: t.onBlue, fontWeight: '700', fontSize: 13 }}>eXO</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{team!.name}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>{division} · {role}</Text>
          </View>
          <Ionicons name="chevron-down" size={20} color={t.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account"
          onPress={account}
          style={{
            ...card,
            width: 48,
            height: 48,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="person-circle-outline" size={24} color={t.text} />
        </Pressable>
      </View>

      <View
        style={{
          borderRadius: 20,
          padding: 20,
          gap: 14,
          backgroundColor: t.hero[0],
          experimental_backgroundImage: `linear-gradient(135deg, ${t.hero[0]}, ${t.hero[1]})`,
        }}
      >
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{live.label}</Text>
          <Chip label="LIVE" bg={HERO_ORANGE} fg={ON_ORANGE} />
        </View>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Score name="Us" value={live.us} />
          <Text style={{ color: '#FFFFFF', fontSize: 14, textAlign: 'center' }}>
            Pt {live.point}
            {'\n'}
            {live.side}
          </Text>
          <Score name={live.opp} value={live.them} />
        </View>
        <Link href="/score" asChild>
          <Pressable
            style={{
              height: 52,
              borderRadius: 14,
              backgroundColor: HERO_ORANGE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: ON_ORANGE, fontWeight: '700', fontSize: 16 }}>
              Resume scoring
            </Text>
          </Pressable>
        </Link>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {actions.map(([label, icon, bg, fg, href]) => (
          <Link key={label} href={href} asChild>
            <Pressable
              style={{
                ...card,
                flex: 1,
                alignItems: 'center',
                gap: 8,
                paddingVertical: 12,
                paddingHorizontal: 4,
                borderRadius: 16,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={icon} size={22} color={fg} />
              </View>
              <Text style={{ color: t.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <View style={{ gap: 10 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <Text style={{ color: t.text, fontSize: 20, fontWeight: '700' }}>Schedule</Text>
          <Link href="/games" style={{ color: t.link, fontSize: 14, fontWeight: '600' }}>
            See all
          </Link>
        </View>
        <View style={{ ...card, borderRadius: 16 }}>
          {schedule.map((g, i) => {
            const chip = resultChip(t, g.kind);
            return (
              <View
                key={g.opp}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: t.line,
                }}
              >
                <View style={{ width: 44, alignItems: 'center' }}>
                  <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700' }}>{g.day}</Text>
                  <Text style={{ ...display, color: t.text, fontSize: 20 }}>{g.date}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '600' }}>vs {g.opp}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>{g.meta}</Text>
                </View>
                <Chip label={g.result} bg={chip.bg} fg={chip.fg} />
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function Chip({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View
      style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: bg }}
    >
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function Score({ name, value }: { name: string; value: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontSize: 13 }}>{name}</Text>
      <Text style={{ ...display, color: '#FFFFFF', fontSize: 52, lineHeight: 56 }}>{value}</Text>
    </View>
  );
}
