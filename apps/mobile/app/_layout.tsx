import { Stack, router } from 'expo-router';
import { Text } from 'react-native';
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
      <Stack.Screen
        name="player"
        options={{
          title: 'Player',
          presentation: 'modal',
          headerLeft: () => (
            <Text accessibilityRole="button" onPress={() => router.back()} style={{ color: '#0B5FA5', fontSize: 17, padding: 8 }}>
              Cancel
            </Text>
          ),
        }}
      />
    </Stack>
  );
}
