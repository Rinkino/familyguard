import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { FamilyMap } from '@/components/map/FamilyMap';
import type { FamilyMapHandle } from '@/components/map/types';
import { Screen, T, TopBar } from '@/components/ui';
import { formatDistance, formatDuration } from '@/lib/geo';
import { buildTimeline, loadHistory, type HistoryPoint, type TimelineItem } from '@/lib/history';
import { addressAt } from '@/lib/mapbox';
import { firstName, useStore } from '@/state/store';
import { space, useColors } from '@/theme';

type Range = 'today' | 'yesterday' | 'week';
const DAY = 86_400_000;

function rangeBounds(range: Range): [number, number] {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const m = midnight.getTime();
  if (range === 'today') return [m, Date.now()];
  if (range === 'yesterday') return [m - DAY, m];
  return [Date.now() - 7 * DAY, Date.now()];
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayAndClock = (ms: number) =>
  new Date(ms).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/** Where someone has been over the last week: trail on the map plus a timeline. */
export default function History() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const map = useRef<FamilyMapHandle>(null);
  const isMe = id === 'me';
  const userId = isMe ? store.me.id : id;
  const person = store.people.find((p) => p.id === id);
  const name = isMe ? 'You' : person ? firstName(person.name) : 'Them';

  const [range, setRange] = useState<Range>('today');
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [error, setError] = useState('');
  const [places, setPlaces] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setPoints(null);
    setError('');
    const [from, to] = rangeBounds(range);
    loadHistory(userId, from, to)
      .then((p) => {
        if (cancelled) return;
        setPoints(p);
        if (p.length > 1) setTimeout(() => map.current?.fitTo(p.map((x) => x.coord)), 300);
        else if (p.length === 1) setTimeout(() => map.current?.flyTo(p[0].coord, 1500), 300);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [userId, range]);

  const timeline = useMemo(() => (points ? buildTimeline(points).reverse() : []), [points]);

  // Name the stops (newest first, a handful at a time to keep lookups light).
  useEffect(() => {
    const stops = timeline.filter((t): t is Extract<TimelineItem, { kind: 'stop' }> => t.kind === 'stop').slice(0, 12);
    stops.forEach((s) => {
      const key = `${s.center.latitude.toFixed(4)},${s.center.longitude.toFixed(4)}`;
      if (places[key]) return;
      addressAt(s.center)
        .then((p) => setPlaces((prev) => ({ ...prev, [key]: p.name === 'Dropped pin' ? p.address : p.name })))
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline]);

  const last = points?.[points.length - 1];

  return (
    <Screen>
      <TopBar title={isMe ? 'Your location history' : `${name}'s location history`} />
      <T v="small" color={c.muted}>
        {isMe
          ? 'Only you and your guardians can see this. Kept for 7 days.'
          : `Only ${name} and their guardians can see this. Kept for 7 days.`}
      </T>

      <View style={{ marginTop: space.md }}>
        <Chips
          options={[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'week', label: 'Last 7 days' },
          ]}
          selected={range}
          onPress={setRange}
        />
      </View>

      <View style={{ height: 280, borderRadius: 20, overflow: 'hidden', marginTop: space.md }}>
        <FamilyMap
          ref={map}
          initialCenter={last?.coord ?? store.myCoord}
          initialSpanM={4000}
          route={points && points.length > 1 ? points.map((p) => p.coord) : undefined}
          pin={last?.coord}
        />
      </View>

      {last && (
        <T v="small" color={c.muted} style={{ marginTop: space.sm }}>
          Last point {dayAndClock(last.at)}. The pin shows where {isMe ? 'your phone' : name} was last seen in this range.
        </T>
      )}

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        {error ? (
          <T v="body" color={c.flare}>Couldn't load history: {error}</T>
        ) : !points ? (
          <ActivityIndicator color={c.beaconText} />
        ) : points.length === 0 ? (
          <View style={{ gap: space.xs }}>
            <T v="heading">Nothing recorded</T>
            <T v="body" color={c.muted}>
              Locations are saved while the app is open and has signal. Points recorded offline upload once it reconnects.
            </T>
          </View>
        ) : (
          timeline.map((item, i) => {
            if (item.kind === 'stop') {
              const key = `${item.center.latitude.toFixed(4)},${item.center.longitude.toFixed(4)}`;
              return (
                <Pressable
                  key={i}
                  onPress={() => map.current?.flyTo(item.center, 900)}
                  style={{ flexDirection: 'row', gap: space.md, backgroundColor: c.surface, borderRadius: 16, padding: space.md }}
                >
                  <Feather name="map-pin" size={18} color={c.beaconText} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{places[key] ?? 'Stayed here'}</T>
                    <T v="small" color={c.muted}>
                      {clock(item.from)} to {clock(item.to)}, {formatDuration((item.to - item.from) / 1000)}
                    </T>
                  </View>
                </Pressable>
              );
            }
            if (item.kind === 'gap') {
              return (
                <View key={i} style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm }}>
                  <Feather name="wifi-off" size={16} color={c.muted} style={{ marginTop: 2 }} />
                  <T v="small" color={c.muted} style={{ flex: 1 }}>
                    No location from {clock(item.from)} to {clock(item.to)}. The phone was off, out of signal, or the app was closed.
                  </T>
                </View>
              );
            }
            return (
              <View key={i} style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.xs }}>
                <Feather name="navigation" size={14} color={c.muted} style={{ marginTop: 3 }} />
                <T v="small" color={c.muted} style={{ flex: 1 }}>
                  Moving {clock(item.from)} to {clock(item.to)}
                  {item.distanceM > 50 ? `, about ${formatDistance(item.distanceM)}` : ''}
                </T>
              </View>
            );
          })
        )}
      </View>
    </Screen>
  );
}
