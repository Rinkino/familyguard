import Slider from '@react-native-community/slider';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { FamilyMap } from '@/components/map/FamilyMap';
import type { FamilyMapHandle } from '@/components/map/types';
import { Button, Field, Screen, Section, Row, T, TopBar, attempt, confirm } from '@/components/ui';
import { formatDistance, type LatLng } from '@/lib/geo';
import { flags } from '@/lib/flags';
import type { Who } from '@/types';
import { firstName, formatRemaining, iGuard, useNow, useStore, whoName, zoneTargets } from '@/state/store';
import { space, useColors } from '@/theme';

const HOUR = 3_600_000;
const MIN_R = 100;
const MAX_R = 10_000;

// Slider is logarithmic so small radii are easy to set precisely.
const toRadius = (t: number) => {
  const r = MIN_R * Math.pow(MAX_R / MIN_R, t);
  return r < 1000 ? Math.round(r / 50) * 50 : Math.round(r / 100) * 100;
};
const toSlider = (r: number) => Math.log(r / MIN_R) / Math.log(MAX_R / MIN_R);

type Duration = number | 'custom' | 'forever' | 'keep';

export default function ZoneScreen() {
  const c = useColors();
  const store = useStore();
  const now = useNow();
  const params = useLocalSearchParams<{ id: string; lat?: string; lng?: string; name?: string }>();
  const existing = store.zones.find((z) => z.id === params.id);
  const map = useRef<FamilyMapHandle>(null);

  const startCenter: LatLng = existing?.center ?? {
    latitude: Number(params.lat ?? store.myCoord.latitude),
    longitude: Number(params.lng ?? store.myCoord.longitude),
  };
  const targets = zoneTargets(store.people);

  const [center, setCenter] = useState(startCenter);
  const [name, setName] = useState(existing?.name ?? (params.name && params.name !== 'Dropped pin' ? params.name : ''));
  const [forId, setForId] = useState<Who>(existing?.forId ?? targets[0]?.id ?? 'me');
  const [radiusM, setRadiusM] = useState(existing?.radiusM ?? 800);
  const [duration, setDuration] = useState<Duration>(existing ? (existing.endsAt ? 'keep' : 'forever') : 4);
  const [customHours, setCustomHours] = useState('');
  const [graceMin, setGraceMin] = useState(existing?.graceMin ?? 10);
  const [countdownS, setCountdownS] = useState(existing?.countdownS ?? 30);
  const [watcherIds, setWatcherIds] = useState<Who[]>(existing?.watcherIds ?? []);

  // While sizing, keep the circle filling the map width so you see the exact streets inside.
  const zoomOutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(zoomOutTimer.current);
    const t = setTimeout(() => map.current?.fitCircle(center, radiusM), 120);
    return () => clearTimeout(t);
  }, [center, radiusM]);

  // Once you stop adjusting, ease out to show the zone in its surroundings.
  const settle = () => {
    clearTimeout(zoomOutTimer.current);
    zoomOutTimer.current = setTimeout(() => map.current?.fitCircle(center, radiusM, 2.4), 1200);
  };
  useEffect(() => () => clearTimeout(zoomOutTimer.current), []);

  // Zones set by someone else are read-only, unless you're a guardian of the person inside.
  const canEdit = !existing || existing.setById === 'me' || iGuard(store.people.find((p) => p.id === existing.forId));
  if (existing && !canEdit) {
    const setter = whoName(store.people, existing.setById);
    return (
      <Screen>
        <TopBar close title={existing.name} />
        <View style={{ height: 220, borderRadius: 20, overflow: 'hidden', marginTop: space.sm }}>
          <FamilyMap initialCenter={existing.center} initialSpanM={existing.radiusM * 2.8} zones={[existing]} static />
        </View>
        <T v="title" style={{ marginTop: space.lg }}>{setter} asked you to stay in {existing.name}</T>
        <T v="body" color={c.muted} style={{ marginTop: space.sm }}>
          You're inside a {formatDistance(existing.radiusM)} circle.{' '}
          {existing.endsAt ? `It ends by itself in ${formatRemaining(existing.endsAt - now)}.` : `It stays on until ${setter} turns it off.`}
        </T>
        <Section title="If you leave">
          <Row><T v="body">{setter} is told straight away.</T></Row>
          <Row><T v="body">After {existing.graceMin} min outside, you're asked if you're OK.</T></Row>
          <Row last><T v="body">No answer in {existing.countdownS} seconds sends an SOS with your location and starts recording audio.</T></Row>
        </Section>
        <View style={{ marginTop: space.xl }}>
          <PretendLeave zoneId={existing.id} />
        </View>
      </Screen>
    );
  }

  const personName = forId === 'me' ? 'you' : firstName(whoName(store.people, forId));
  const endsAt =
    duration === 'keep' ? existing?.endsAt ?? null
    : duration === 'forever' ? null
    : duration === 'custom' ? (Number(customHours) > 0 ? Date.now() + Number(customHours) * HOUR : null)
    : Date.now() + duration * HOUR;
  const customInvalid = duration === 'custom' && !(Number(customHours) > 0 && Number(customHours) <= 168);

  const save = () =>
    attempt(
      store.actions.saveZone({
        id: existing?.id,
        name: name.trim(),
        forId,
        center,
        radiusM,
        endsAt,
        graceMin,
        countdownS,
        watcherIds: watcherIds.filter((w) => w !== forId),
      }),
      () => {
        flags.focusZone = { center, radiusM };
        router.back();
      }
    );

  const durationOptions: { key: Duration; label: string }[] = [
    ...(existing?.endsAt ? [{ key: 'keep' as const, label: `Keep (${formatRemaining(existing.endsAt - now)} left)` }] : []),
    ...[1, 2, 4, 8, 12, 24].map((h) => ({ key: h as Duration, label: `${h} h` })),
    { key: 'custom', label: 'Other' },
    { key: 'forever', label: 'Until I turn it off' },
  ];

  return (
    <Screen>
      <TopBar close title={existing ? 'Edit zone' : 'New zone'} />

      <View style={{ height: 240, borderRadius: 20, overflow: 'hidden', marginTop: space.sm }}>
        <FamilyMap
          ref={map}
          initialCenter={center}
          initialSpanM={radiusM * 2.8}
          zones={[{ id: 'draft', center, radiusM }]}
          pin={center}
          onLongPress={(p) => {
            setCenter(p);
            settle();
          }}
        />
      </View>
      <T v="small" color={c.muted} style={{ marginTop: space.sm }}>
        {Platform.OS === 'web' ? 'Click' : 'Long-press'} the map to move the centre.
      </T>

      <View style={{ marginTop: space.lg }}>
        <Field label="Zone name" value={name} onChangeText={setName} placeholder="e.g. School, Home, Campus" />
      </View>

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <T v="smallStrong" color={c.muted}>Who should stay inside</T>
        <Chips
          options={[{ key: 'me', label: 'You' }, ...targets.map((p) => ({ key: p.id, label: firstName(p.name) }))]}
          selected={forId}
          onPress={setForId}
        />
        {forId !== 'me' && (
          <T v="small" color={c.muted}>{personName} will be told about this zone and when it ends.</T>
        )}
        {targets.length === 0 && (
          <T v="small" color={c.muted}>You can set zones for people once they share their location with you.</T>
        )}
      </View>

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T v="smallStrong" color={c.muted}>Size</T>
          <T v="heading">{formatDistance(radiusM)}</T>
        </View>
        <Slider
          accessibilityLabel="Zone radius"
          value={toSlider(radiusM)}
          onValueChange={(t) => setRadiusM(toRadius(t))}
          onSlidingComplete={settle}
          minimumValue={0}
          maximumValue={1}
          minimumTrackTintColor={c.beacon}
          maximumTrackTintColor={c.hairline}
          thumbTintColor={c.beacon}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T v="tiny" color={c.muted}>100 m</T>
          <T v="tiny" color={c.muted}>10 km</T>
        </View>
      </View>

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <T v="smallStrong" color={c.muted}>How long</T>
        <Chips options={durationOptions} selected={duration} onPress={setDuration} />
        {duration === 'custom' && (
          <Field
            label="Hours (up to 168)"
            value={customHours}
            onChangeText={(v) => setCustomHours(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="e.g. 6"
          />
        )}
        <T v="small" color={c.muted}>
          {endsAt ? 'The zone switches itself off when time is up.' : 'The zone stays on until you turn it off.'}
        </T>
      </View>

      <Section title="If they leave" note={`Everyone alerted gets ${personName === 'you' ? 'your' : `${personName}'s`} location. After an SOS, audio recording starts on the phone.`}>
        <View style={{ padding: space.md, gap: space.sm }}>
          <T v="body">Wait before asking “Are you OK?”</T>
          <Chips
            options={[0, 1, 5, 10, 15, 30].map((m) => ({ key: m, label: m === 0 ? 'Ask now' : `${m} min` }))}
            selected={graceMin}
            onPress={setGraceMin}
          />
        </View>
        <View style={{ padding: space.md, paddingTop: 0, gap: space.sm }}>
          <T v="body">Time to answer before SOS</T>
          <Chips options={[15, 30, 60].map((s) => ({ key: s, label: `${s} s` }))} selected={countdownS} onPress={setCountdownS} />
        </View>
      </Section>

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <T v="smallStrong" color={c.muted}>Also alert</T>
        <Chips
          multi
          options={store.people
            .filter((p) => p.status === 'connected' && p.id !== forId)
            .map((p) => ({ key: p.id, label: firstName(p.name) }))}
          selected={watcherIds}
          onPress={(id) => setWatcherIds((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))}
        />
        <T v="small" color={c.muted}>{forId === 'me' ? 'Pick who gets alerted if you leave.' : "You're always alerted."}</T>
      </View>

      <View style={{ marginTop: space.xl, gap: space.sm }}>
        <Button
          label={existing ? 'Save zone' : 'Start zone'}
          disabled={!name.trim() || customInvalid || (forId === 'me' && watcherIds.length === 0)}
          onPress={save}
        />
        {forId === 'me' && watcherIds.length === 0 && (
          <T v="small" color={c.muted} style={{ textAlign: 'center' }}>Pick at least one person to alert.</T>
        )}
        {existing && (
          <>
            {existing.forId === 'me' && <PretendLeave zoneId={existing.id} />}
            <Button
              kind="danger"
              label="Turn off zone"
              onPress={() =>
                confirm(`Turn off ${existing.name}?`, `${personName === 'you' ? 'Your watchers' : personName} will be told it has ended.`, 'Turn off', () => {
                  attempt(store.actions.endZone(existing.id), () => router.back());
                })
              }
            />
          </>
        )}
      </View>
    </Screen>
  );
}

/** Testing aid: reports a position just outside the zone and holds it for 3 minutes. */
function PretendLeave({ zoneId }: { zoneId: string }) {
  const c = useColors();
  const store = useStore();
  const zone = store.zones.find((z) => z.id === zoneId);
  if (!zone) return null;
  return (
    <View style={{ gap: space.xs }}>
      <Button
        kind="secondary"
        label="Test: pretend I left"
        onPress={() => attempt(store.actions.pretendLeave(zone), () => router.back())}
      />
      <T v="tiny" color={c.muted} style={{ textAlign: 'center' }}>
        Sends a fake position just outside for 3 minutes, then real GPS takes over again.
      </T>
    </View>
  );
}
