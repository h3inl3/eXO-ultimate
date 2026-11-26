import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTheme } from '../../src/theme';

const TABS: Array<[name: string, title: string, icon: ComponentProps<typeof Ionicons>['name']]> = [
  ['index', 'Home', 'home-outline'],
  ['roster', 'Roster', 'people-outline'],
  ['games', 'Games', 'disc-outline'],
  ['playbook', 'Playbook', 'clipboard-outline'],
  ['stats', 'Stats', 'stats-chart-outline'],
];

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.link,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => <Ionicons name={icon} size={24} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
