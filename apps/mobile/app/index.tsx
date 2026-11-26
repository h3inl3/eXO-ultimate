import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

// Placeholder home. Phase 1 replaces this with sign-in + the team switcher.
export default function Home() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: '700' }}>eXO Ultimate</Text>
      <Text>Roster · Seasons · Games · Playbook</Text>
      <Link href="/score" asChild>
        <Pressable style={{ backgroundColor: '#1f6feb', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}>
          <Text style={{ color: 'white', fontWeight: '600' }}>Try the scoring prototype</Text>
        </Pressable>
      </Link>
    </View>
  );
}
