import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, Switch, Text, View } from 'react-native';
import { POSITIONS } from '@exo/shared';
import { WEB_URL, api, useSession } from '../src/session';
import { useTheme } from '../src/theme';
import { Button, Choice, Field, Loading, Notice, apiError } from '../src/ui';

type Position = (typeof POSITIONS)[number];

/** Add a player (no id) or edit one. Only coaches and owners reach this screen. */
export default function PlayerScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { team } = useSession();
  const [ready, setReady] = useState(!id);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [gender, setGender] = useState<'' | 'MMP' | 'FMP'>('');
  const [positions, setPositions] = useState<Position[]>([]);
  const [email, setEmail] = useState('');
  const [active, setActive] = useState(true);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    if (!id) return;
    // shortcut: no single-player endpoint yet, so read it from the roster list.
    api.GET('/v1/teams/{teamId}/players', { params: { path: { teamId: team!.id }, query: { includeInactive: 'true' } } }).then((r) => {
      const p = r.data?.find((x) => x.id === id);
      if (!p) return setError('Player not found.');
      setName(p.name);
      setNumber(p.number?.toString() ?? '');
      setGender(p.genderMatch ?? '');
      setPositions(p.positions);
      setEmail(p.email ?? '');
      setActive(p.active);
      setLinked(Boolean(p.userId));
      setReady(true);
    });
  }, [id, team]);

  const body = {
    name: name.trim(),
    number: number ? Number(number) : undefined,
    genderMatch: gender || null,
    positions,
    email: email.trim() || undefined,
  };
  const save = async () => {
    const res = id
      ? await api.PATCH('/v1/players/{id}', { params: { path: { id } }, body: { ...body, active } })
      : await api.POST('/v1/teams/{teamId}/players', { params: { path: { teamId: team!.id } }, body });
    if (res.error) return setError(apiError(res.error));
    router.back();
  };
  const invite = async () => {
    const res = await api.POST('/v1/players/{id}/invite', { params: { path: { id: id! } } });
    if (!res.data) return setError(apiError(res.error));
    // The code goes in the fragment, which browsers never send to a server, so it stays out of logs.
    const link = `${WEB_URL}/join#${res.data.code}`;
    await Share.share({ message: `Join ${team!.name} on eXO Ultimate: ${link}` });
  };
  const remove = () =>
    Alert.alert(`Delete ${name}?`, 'Players with game stats are deactivated instead, so their stats stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const res = await api.DELETE('/v1/players/{id}', { params: { path: { id: id! } } });
          if (res.error) return setError(apiError(res.error));
          if (res.data?.deleted === 'soft') Alert.alert('Deactivated', `${name} has game stats, so they were deactivated instead.`);
          router.back();
        },
      },
    ]);

  if (!ready) return error ? <View style={{ padding: 20 }}><Notice>{error}</Notice></View> : <Loading />;
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} />
      <Field label="Jersey number" value={number} onChangeText={(v) => setNumber(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
      {team!.division === 'mixed' && (
        <Choice label="Gender match" options={[['', 'None'], ['MMP', 'MMP'], ['FMP', 'FMP']] as const} value={gender} onChange={setGender} />
      )}
      <View style={{ gap: 6 }}>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>Positions</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {POSITIONS.map((pos) => (
            <Button
              key={pos}
              label={positions.includes(pos) ? `✓ ${pos}` : pos}
              onPress={() => setPositions((cur) => (cur.includes(pos) ? cur.filter((x) => x !== pos) : [...cur, pos]))}
            />
          ))}
        </View>
      </View>
      <Field label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      {id && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
          <Text style={{ color: t.text, fontSize: 16 }}>Active</Text>
          <Switch value={active} onValueChange={setActive} accessibilityLabel="Active" />
        </View>
      )}
      {error && <Notice>{error}</Notice>}
      <Button label={id ? 'Save' : 'Add player'} primary disabled={!name.trim()} onPress={save} />
      {id && active && !linked && <Button label="Send invite" onPress={invite} />}
      {id && <Button label="Delete player" onPress={remove} />}
    </ScrollView>
  );
}
