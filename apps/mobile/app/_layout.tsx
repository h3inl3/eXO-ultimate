import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'eXO Ultimate' }} />
      <Stack.Screen name="score" options={{ title: 'Scoring prototype' }} />
    </Stack>
  );
}
