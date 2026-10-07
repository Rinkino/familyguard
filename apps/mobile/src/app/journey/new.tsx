import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { FamilyMap } from '@/components/map/FamilyMap';
import type { FamilyMapHandle } from '@/components/map/types';
import { Button, Screen, Section, T, TopBar } from '@/components/ui';
import { formatDistance, formatDuration, type LatLng } from '@/lib/geo';
import { getRoute, type Route, type TravelMode } from '@/lib/mapbox';
import { firstName, myGuardians, myJourney, useStore } from '@/state/store';
import { space, useColors } from '@/theme';

const MODES: { key: TravelMode; label: string }[] = [
  { key: 'walking', label: 'Walk' },
  { key: 'driving', label: 'Car or bus' },
  { key: 'cycling', label: 'Bike' },
];

/** Plan a journey: the server watches the route and alerts if you stray from it. */
export default function NewJourney() {
  const c = useColors();
  const store = useStore();
  const params = useLocalSearchParams<{ name?: string; lat?: string; lng?: string }>();
  const destination: LatLng = { latitude: Number(params.lat), longitude: Number(params.lng) };
  const destinationName = params.name || 'Destination';
  const map = useRef<FamilyMapHandle>(null);

  const connected = store.people.filter((p) => p.status === 'connected');
  const guardians = myGuardians(store.people);
  const [mode, setMode] = useState<TravelMode>('driving');
  const [route, setRoute] = useState<Route | null>(null);
  const [routeError, setRouteError] = useState('');
  const [watcherIds, setWatcherIds] = useState<string[]>(() =>
    connected.filter((p) => p.iShare || guardians.some((g) => g.id === p.id)).map((p) => p.id)
  );
  const [maxDeviationM, setMaxDeviationM] = useState(250);
  const [graceMin, setGraceMin] = useState(5);
  const [countdownS, setCountdownS] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRoute(null);
    setRouteError('');
    getRoute(store.myCoord, destination, mode)
      .then((r) => {
        if (cancelled) return;
        setRoute(r);
        setTimeout(() => map.current?.fitTo(r.coords), 200);
      })
      .catch(() => !cancelled && setRouteError("Couldn't find a route. Try another way of travelling."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (myJourney(store.journeys)) {
    return (
      <Screen>
        <TopBar close title="Start journey" />
        <T v="heading" style={{ marginTop: space.lg }}>You're already on a journey</T>
        <T v="body" color={c.muted} style={{ marginTop: space.sm }}>End it on the Map before starting another.</T>
      </Screen>
    );
  }

  const start = async () => {
    if (!route) return;
    setBusy(true);
    setError('');
    try {
      await store.actions.startJourney({
        destinationName,
        destination,
        mode,
        route: route.coords,
        distanceM: route.distanceM,
        durationS: route.durationS,
        maxDeviationM,
        graceMin,
        countdownS,
        watcherIds,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the journey. Try again.");
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar close title="Start journey" />
      <T v="title" style={{ marginTop: space.sm }}>To {destinationName}</T>

      <View style={{ height: 220, borderRadius: 20, overflow: 'hidden', marginTop: space.md }}>
        <FamilyMap
          ref={map}
          initialCenter={destination}
          initialSpanM={6000}
          route={route?.coords}
          markers={[{ id: 'dest', coord: destination, kind: 'destination', title: destinationName }]}
          people={[{ id: 'me', name: store.me.name || 'You', tint: store.me.tint, coord: store.myCoord }]}
        />
      </View>
      {route ? (
        <T v="body" style={{ marginTop: space.sm }}>
          About {formatDuration(route.durationS)}, {formatDistance(route.distanceM)}.
        </T>
      ) : routeError ? (
        <T v="small" color={c.flare} style={{ marginTop: space.sm }}>{routeError}</T>
      ) : (
        <ActivityIndicator color={c.beaconText} style={{ marginTop: space.sm }} />
      )}

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <T v="smallStrong" color={c.muted}>How you're travelling</T>
        <Chips options={MODES} selected={mode} onPress={setMode} />
        {mode === 'driving' && (
          <T v="small" color={c.muted}>Buses and danfos use the road route.</T>
        )}
      </View>

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <T v="smallStrong" color={c.muted}>Who watches this journey</T>
        {connected.length === 0 ? (
          <T v="small" color={c.muted}>Connect with someone first so they can watch your journeys.</T>
        ) : (
          <Chips
            multi
            options={connected.map((p) => ({ key: p.id, label: firstName(p.name) }))}
            selected={watcherIds}
            onPress={(id) => setWatcherIds((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))}
          />
        )}
        <T v="small" color={c.muted}>
          They see your route, destination and position until you arrive.
          {guardians.length > 0 ? ' Your guardians always watch.' : ''}
        </T>
      </View>

      <Section title="If you go off route">
        <View style={{ padding: space.md, gap: space.sm }}>
          <T v="body">How far off counts</T>
          <Chips
            options={[100, 250, 500, 1000].map((m) => ({ key: m, label: formatDistance(m) }))}
            selected={maxDeviationM}
            onPress={setMaxDeviationM}
          />
        </View>
        <View style={{ padding: space.md, paddingTop: 0, gap: space.sm }}>
          <T v="body">Wait before asking “Are you OK?”</T>
          <Chips
            options={[0, 1, 5, 10, 15].map((m) => ({ key: m, label: m === 0 ? 'Ask now' : `${m} min` }))}
            selected={graceMin}
            onPress={setGraceMin}
          />
        </View>
        <View style={{ padding: space.md, paddingTop: 0, gap: space.sm }}>
          <T v="body">Time to answer before SOS</T>
          <Chips options={[15, 30, 60].map((s) => ({ key: s, label: `${s} s` }))} selected={countdownS} onPress={setCountdownS} />
        </View>
      </Section>

      <T v="small" color={c.muted} style={{ marginTop: space.md }}>
        Watchers are told straight away when you go off route. If a road is blocked, report it and reroute so the alert clears.
      </T>

      <View style={{ marginTop: space.xl, gap: space.sm }}>
        <Button label={busy ? 'Starting…' : 'Start journey'} disabled={!route || busy} onPress={start} />
        {error ? <T v="small" color={c.flare}>{error}</T> : null}
      </View>
    </Screen>
  );
}
