import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { fonts, useColors } from '@/theme';

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
        tabBarActiveTintColor: c.beaconText,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.hairline },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Map', tabBarIcon: ({ color, size }) => <Feather name="map" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="people"
        options={{ title: 'People', tabBarIcon: ({ color, size }) => <Feather name="users" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="circles"
        options={{ title: 'Circles', tabBarIcon: ({ color, size }) => <Feather name="circle" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="you"
        options={{ title: 'You', tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
