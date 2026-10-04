import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Row, Screen, Section, T, TopBar } from '@/components/ui';
import { defaultTitle, listRecordingGroups, type RecordingGroup } from '@/lib/recordings';
import { useStore, whoName } from '@/state/store';
import { space, useColors } from '@/theme';

function formatLength(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

/** Every SOS with audio you can see: your own and people you watch. */
export default function Recordings() {
  const c = useColors();
  const store = useStore();
  const [groups, setGroups] = useState<RecordingGroup[] | null>(null);
  const [error, setError] = useState('');

  // Reload whenever the screen is shown, e.g. after renaming or deleting.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listRecordingGroups()
        .then((g) => !cancelled && setGroups(g))
        .catch((e) => !cancelled && setError(e.message));
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const who = (userId: string) => (userId === store.me.id ? 'You' : whoName(store.people, userId, 'You'));
  const mine = groups?.filter((g) => g.forUser === store.me.id) ?? [];
  const others = groups?.filter((g) => g.forUser !== store.me.id) ?? [];

  const renderGroup = (g: RecordingGroup, i: number, list: RecordingGroup[]) => (
    <Row key={g.alertId} last={i === list.length - 1} onPress={() => router.push(`/recording/${g.alertId}`)}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.flareSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="mic" size={16} color={c.flare} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong" numberOfLines={2}>{g.title ?? defaultTitle(g)}</T>
        <T v="small" color={c.muted}>
          {who(g.forUser)}, {g.clipCount} {g.clipCount === 1 ? 'clip' : 'clips'}, {formatLength(g.totalMs)}
        </T>
      </View>
      <Feather name="chevron-right" size={18} color={c.muted} />
    </Row>
  );

  return (
    <Screen>
      <TopBar title="Recordings" />
      {error ? (
        <T v="body" color={c.flare} style={{ marginTop: space.lg }}>Couldn't load recordings: {error}</T>
      ) : !groups ? (
        <ActivityIndicator color={c.beaconText} style={{ marginTop: space.xl }} />
      ) : groups.length === 0 ? (
        <View style={{ marginTop: space.xl, gap: space.sm }}>
          <T v="heading">No recordings</T>
          <T v="body" color={c.muted}>
            When an SOS goes out, audio is recorded on that phone and appears here for them and everyone watching.
          </T>
        </View>
      ) : (
        <>
          {mine.length > 0 && <Section title="Your SOS">{mine.map(renderGroup)}</Section>}
          {others.length > 0 && <Section title="People you watch">{others.map(renderGroup)}</Section>}
        </>
      )}
    </Screen>
  );
}
