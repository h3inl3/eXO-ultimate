import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DIVISIONS } from '@exo/shared';
import { api, useSession } from './session';
import { useTheme } from './theme';
import { Button, Choice, Field, Notice, apiError } from './ui';

/** Shown instead of the app when signed out, or signed in with no team yet. */
export function Welcome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { status, signIn, signOut, reload, setTeam } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [division, setDivision] = useState<(typeof DIVISIONS)[number]>('mixed');

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(await fn());
    setBusy(false);
  };
  const createTeam = async () => {
    const res = await api.POST('/v1/teams', { body: { name: name.trim(), division } });
    if (!res.data) return apiError(res.error);
    setTeam(res.data.id);
    await reload();
    return null;
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 24, paddingTop: insets.top + 48, gap: 16 }} automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      <Text style={{ color: t.text, fontSize: 32, fontWeight: '700' }}>
        {status === 'signedIn' ? 'Create your first team' : 'Run your ultimate team'}
      </Text>
      {status === 'signedIn' ? (
        <View style={{ gap: 16 }}>
          <Text style={{ color: t.muted, fontSize: 16 }}>
            Joining as a player? Open the invite link your coach sent you instead.
          </Text>
          <Field label="Team name" value={name} onChangeText={setName} maxLength={80} />
          <Choice
            label="Division"
            options={DIVISIONS.map((d) => [d, d[0]!.toUpperCase() + d.slice(1)] as const)}
            value={division}
            onChange={setDivision}
          />
          <Button label="Create team" primary disabled={busy || !name.trim()} onPress={() => run(createTeam)} />
          <Button label="Sign out" onPress={signOut} />
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <Text style={{ color: t.muted, fontSize: 16 }}>Rosters, seasons, live stats and a playbook.</Text>
          <Button label="Sign in or create an account" primary disabled={busy} onPress={() => run(signIn)} />
        </View>
      )}
      {error && <Notice>{error}</Notice>}
    </ScrollView>
  );
}
