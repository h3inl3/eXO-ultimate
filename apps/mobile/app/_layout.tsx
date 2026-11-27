import { Stack } from 'expo-router';
import { SessionProvider, useSession } from '../src/session';
import { Loading } from '../src/ui';
import { Welcome } from '../src/Welcome';

export default function RootLayout() {
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  );
}

function Gate() {
  const { status, team } = useSession();
  if (status === 'loading') return <Loading />;
  if (status === 'signedOut' || !team) return <Welcome />;
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="score" options={{ title: 'Scoring prototype' }} />
      <Stack.Screen name="player" options={{ title: 'Player', presentation: 'modal' }} />
    </Stack>
  );
}
