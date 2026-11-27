import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ROLES, type Role } from '@exo/shared';
import { api, isStaff, useSession } from '../../src/session';
import { useTheme } from '../../src/theme';
import { Button, Choice, Field, Notice, apiError } from '../../src/ui';

type Player = { id: string; name: string; number: number | null; genderMatch: 'MMP' | 'FMP' | null; active: boolean; userId: string | null };
type Member = { userId: string; email: string | null; name: string | null; role: Role };
const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', coach: 'Coach', stat_keeper: 'Stat keeper', player: 'Player' };

export default function Roster() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { team, me, reload: reloadSession } = useSession();
  const staff = isStaff(team!.role);
  const [players, setPlayers] = useState<Player[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('coach');
  // Only owners may grant the owner role (the API enforces it too).
  const grantable = ROLES.filter((r) => r !== 'owner' || team!.role === 'owner');

  const load = useCallback(async () => {
    setLoading(true);
    const [p, m] = await Promise.all([
      api.GET('/v1/teams/{teamId}/players', { params: { path: { teamId: team!.id }, query: staff ? { includeInactive: 'true' } : {} } }),
      api.GET('/v1/teams/{id}/members', { params: { path: { id: team!.id } } }),
    ]);
    setPlayers(p.data ?? []);
    setMembers(m.data ?? []);
    setError(p.error || m.error ? apiError(p.error ?? m.error) : null);
    setLoading(false);
  }, [team, staff]);
  useFocusEffect(useCallback(() => void load(), [load])); // refreshes after the player screen closes

  const act = async (res: Promise<{ error?: unknown }>, after?: () => Promise<void>) => {
    const r = await res;
    if (r.error) return setError(apiError(r.error));
    setError(null);
    await (after ?? load)();
  };
  const addMember = () =>
    act(api.POST('/v1/teams/{id}/members', { params: { path: { id: team!.id } }, body: { email: email.trim(), role } }), async () => {
      setEmail('');
      await load();
    });
  const memberActions = (m: Member) => {
    const path = { id: team!.id, userId: m.userId };
    const remove = (self: boolean) => () =>
      act(api.DELETE('/v1/teams/{id}/members/{userId}', { params: { path } }), self ? reloadSession : undefined);
    if (m.userId === me!.id) {
      return Alert.alert('Leave team?', `You'll lose access to ${team!.name}.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: remove(true) },
      ]);
    }
    Alert.alert(m.name ?? m.email ?? 'Member', `Currently ${ROLE_LABEL[m.role]}`, [
      ...grantable.filter((r) => r !== m.role).map((r) => ({
        text: `Make ${ROLE_LABEL[r]}`,
        onPress: () => act(api.PATCH('/v1/teams/{id}/members/{userId}', { params: { path }, body: { role: r } })),
      })),
      { text: 'Remove from team', style: 'destructive' as const, onPress: remove(false) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };
  // Coaches can't change owners; the API returns 403 anyway, so don't offer it.
  const canManage = (m: Member) => m.userId === me!.id || (staff && (m.role !== 'owner' || team!.role === 'owner'));

  const card = { backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 16 } as const;
  const row = { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16 } as const;
  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, padding: 20, gap: 16 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: t.text, fontSize: 28, fontWeight: '700' }}>Roster</Text>
        {staff && <Button label="Add player" primary onPress={() => router.push('/player')} />}
      </View>
      {error && <Notice>{error}</Notice>}

      <View style={card}>
        {players.length === 0 && !loading && <Text style={{ color: t.muted, padding: 16 }}>No players yet.</Text>}
        {players.map((p, i) => {
          const content = (
            <View style={{ ...row, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, opacity: p.active ? 1 : 0.55 }}>
              <Text style={{ color: t.text, width: 32, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{p.number ?? '–'}</Text>
              <Text style={{ color: t.text, flex: 1, fontSize: 16, fontWeight: '600' }}>{p.name}</Text>
              {p.genderMatch && <Text style={{ color: t.muted, fontSize: 13, fontWeight: '700' }}>{p.genderMatch}</Text>}
              {!p.active && <Text style={{ color: t.muted, fontSize: 13 }}>Inactive</Text>}
              {p.userId && <Text style={{ color: t.muted, fontSize: 13 }}>Account</Text>}
            </View>
          );
          return staff ? (
            <Link key={p.id} href={{ pathname: '/player', params: { id: p.id } }} asChild>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${p.name}`}>{content}</Pressable>
            </Link>
          ) : (
            <View key={p.id}>{content}</View>
          );
        })}
      </View>

      <Text style={{ color: t.text, fontSize: 20, fontWeight: '700' }}>People with access</Text>
      <View style={card}>
        {members.map((m, i) => (
          <Pressable
            key={m.userId}
            disabled={!canManage(m)}
            onPress={() => memberActions(m)}
            accessibilityRole={canManage(m) ? 'button' : undefined}
            style={{ ...row, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>
                {m.name ?? m.email ?? 'Team member'}
                {m.userId === me!.id ? ' (you)' : ''}
              </Text>
              {m.email && m.name && <Text style={{ color: t.muted, fontSize: 13 }}>{m.email}</Text>}
            </View>
            <Text style={{ color: t.muted, fontSize: 13, fontWeight: '700' }}>{ROLE_LABEL[m.role]}</Text>
          </Pressable>
        ))}
      </View>
      {staff && (
        <View style={{ ...card, padding: 16, gap: 12 }}>
          <Text style={{ color: t.muted }}>Add coaches and stat keepers by the email they signed in with.</Text>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Choice label="Role" options={grantable.map((r) => [r, ROLE_LABEL[r]] as const)} value={role} onChange={setRole} />
          <Button label="Add" disabled={!email.trim()} onPress={addMember} />
        </View>
      )}
    </ScrollView>
  );
}
