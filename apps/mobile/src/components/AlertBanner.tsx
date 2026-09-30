import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { ZoneAlert } from '@/types';
import { formatRemaining, useNow, useStore, whoName } from '@/state/store';
import { space, useColors } from '@/theme';
import { T } from './ui';

/** One line per live alert. Your own alerts open the check-in screen. */
export function AlertBanner({ alert }: { alert: ZoneAlert }) {
  const c = useColors();
  const store = useStore();
  const now = useNow();
  const zoneName = alert.zoneName ?? 'the zone';
  const name = whoName(store.people, alert.forId);
  const left = alert.stageEndsAt ? formatRemaining(alert.stageEndsAt - now) : '';
  const self = alert.forId === 'me';

  const text = self
    ? {
        left: `You left ${zoneName}. We'll check in with you in ${left}.`,
        checking: `Are you OK? Answer in ${left}.`,
        sos: 'SOS sent. Tap when you are safe.',
        resolved: '',
      }[alert.stage]
    : {
        left: `${name} left ${zoneName}. Checking in with ${name} in ${left}.`,
        checking: `Waiting for ${name} to answer. SOS in ${left}.`,
        sos: `SOS from ${name}. Tap to see where.`,
        resolved: '',
      }[alert.stage];

  const urgent = alert.stage !== 'left';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(self ? '/check-in' : `/alert/${alert.id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: urgent ? c.flare : c.flareSoft,
      }}
    >
      <Feather name="alert-triangle" size={18} color={urgent ? '#FFFFFF' : c.flare} />
      <View style={{ flex: 1 }}>
        <T v="smallStrong" color={urgent ? '#FFFFFF' : c.ink}>{text}</T>
      </View>
      <Feather name="chevron-right" size={18} color={urgent ? '#FFFFFF' : c.flare} />
    </Pressable>
  );
}
