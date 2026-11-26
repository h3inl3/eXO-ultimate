import { Text, View } from 'react-native';
import { useTheme } from './theme';

/** Placeholder for tabs not designed yet. */
export function Soon({ title }: { title: string }) {
  const t = useTheme();
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}
    >
      <Text style={{ color: t.muted, fontSize: 16 }}>{title} is coming soon</Text>
    </View>
  );
}
