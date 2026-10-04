import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertBanner } from '@/components/AlertBanner';
import { BottomSheet, type Snap } from '@/components/BottomSheet';
import { FamilyMap } from '@/components/map/FamilyMap';
import type { FamilyMapHandle, MapPerson } from '@/components/map/types';
import { Avatar, Button, Row, T, attempt } from '@/components/ui';
import { distanceMeters, formatDistance, formatDuration, type LatLng } from '@/lib/geo';
import { flags } from '@/lib/flags';
import { addressAt, getRoute, hasMapboxToken, searchPlaces, type Place, type Route, type TravelMode } from '@/lib/mapbox';
import { activeAlerts, firstName, formatAgo, formatRemaining, useNow, useStore, whoName } from '@/state/store';
import { space, type, useColors } from '@/theme';

const MODES: { mode: TravelMode; label: string; icon: 'navigation' | 'truck' | 'wind' }[] = [
  { mode: 'walking', label: 'Walk', icon: 'navigation' },
  { mode: 'driving', label: 'Car', icon: 'truck' },
  { mode: 'cycling', label: 'Bike', icon: 'wind' },
];

/** What the panel is showing: nothing, a place, a person who shares with you, or a zone. */
type Selection = { kind: 'place'; place: Place } | { kind: 'person'; id: string } | { kind: 'zone'; id: string } | null;

/** Re-route to a moving friend once they've moved this far. */
const REROUTE_M = 150;

export default function MapScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const now = useNow();
  const map = useRef<FamilyMapHandle>(null);

  const [snap, setSnap] = useState<Snap>('half');
  const [sheetH, setSheetH] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selection, setSelection] = useState<Selection>(null);
  const [mode, setMode] = useState<TravelMode>('driving');
  const [route, setRoute] = useState<Route | null>(null);
  const [routeState, setRouteState] = useState<'idle' | 'loading' | 'error'>('idle');
  const routedFrom = useRef<LatLng | null>(null);

  const alerts = activeAlerts(store.alerts);
  const alertFor = new Set(alerts.map((a) => a.forId));
  const zoneAlert = new Set(alerts.map((a) => a.zoneId));

  // Right after onboarding, offer to add the first person once.
  useEffect(() => {
    if (flags.offerAddPerson && store.loaded && store.people.length === 0) {
      flags.offerAddPerson = false;
      router.push('/add-person');
    }
  }, [store.loaded, store.people.length]);

  // After saving a zone: fly in to see it, then ease out to show its surroundings.
  useFocusEffect(
    useCallback(() => {
      const f = flags.focusZone;
      if (!f) return;
      flags.focusZone = null;
      const t1 = setTimeout(() => map.current?.fitCircle(f.center, f.radiusM), 350);
      const t2 = setTimeout(() => map.current?.fitCircle(f.center, f.radiusM, 2.6), 2200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }, [])
  );

  const people: MapPerson[] = useMemo(
    () => [
      { id: 'me', name: store.me.name || 'You', tint: store.me.tint, coord: store.myCoord, alert: alertFor.has('me') },
      ...store.people
        .filter((p) => p.status === 'connected' && p.theyShare && p.coord)
        .map((p) => ({ id: p.id, name: p.name, tint: p.tint, coord: p.coord!, alert: alertFor.has(p.id) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.people, store.myCoord, store.me, alerts.length]
  );

  const selectedPerson = selection?.kind === 'person' ? store.people.find((p) => p.id === selection.id) : undefined;
  const selectedZone = selection?.kind === 'zone' ? store.zones.find((z) => z.id === selection.id) : undefined;
  const destination: { name: string; coord: LatLng } | null =
    selection?.kind === 'place'
      ? { name: selection.place.name, coord: selection.place.coord }
      : selectedPerson?.coord
        ? { name: firstName(selectedPerson.name), coord: selectedPerson.coord }
        : null;

  // Debounced search; cancels the previous request as you type.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError('');
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(query, store.myCoord, ctrl.signal));
        setSearchError('');
      } catch {
        if (!ctrl.signal.aborted) setSearchError('Search is unavailable. Check your connection and try again.');
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, store.myCoord]);

  const resetRoute = () => {
    setRoute(null);
    setRouteState('idle');
    routedFrom.current = null;
  };

  const select = (next: Selection) => {
    setSelection(next);
    resetRoute();
    setQuery('');
    setResults([]);
    if (snap === 'peek') setSnap('half');
  };

  const choosePlace = (place: Place) => {
    select({ kind: 'place', place });
    map.current?.flyTo(place.coord, 2500);
  };

  const choosePerson = (id: string) => {
    if (id === 'me') return map.current?.flyTo(store.myCoord, 1500);
    const p = store.people.find((x) => x.id === id);
    if (!p?.coord) return router.push(`/person/${id}`);
    select({ kind: 'person', id });
    map.current?.flyTo(p.coord, 1500);
  };

  const chooseZone = (id: string) => {
    const z = store.zones.find((x) => x.id === id);
    if (!z) return;
    select({ kind: 'zone', id });
    map.current?.fitCircle(z.center, z.radiusM);
  };

  const dropPin = async (coord: LatLng) => {
    choosePlace({ id: 'pending', name: 'Dropped pin', address: 'Finding address…', coord });
    const place = await addressAt(coord);
    setSelection((s) => (s?.kind === 'place' && s.place.id === 'pending' ? { kind: 'place', place } : s));
  };

  const directions = async (m: TravelMode = mode) => {
    if (!destination) return;
    setMode(m);
    setRouteState('loading');
    try {
      const r = await getRoute(store.myCoord, destination.coord, m);
      setRoute(r);
      setRouteState('idle');
      routedFrom.current = destination.coord;
      map.current?.fitTo(r.coords);
    } catch {
      setRouteState('error');
    }
  };

  // Keep the route to a friend fresh as they move.
  useEffect(() => {
    if (selection?.kind !== 'person' || !route || !selectedPerson?.coord || !routedFrom.current) return;
    if (distanceMeters(routedFrom.current, selectedPerson.coord) < REROUTE_M) return;
    getRoute(store.myCoord, selectedPerson.coord, mode)
      .then((r) => {
        setRoute(r);
        routedFrom.current = selectedPerson.coord!;
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPerson?.coord?.latitude, selectedPerson?.coord?.longitude]);

  const zoneRows = store.zones.map((z) => {
    const who = whoName(store.people, z.forId);
    const by = z.setById === 'me' ? '' : ` Set by ${whoName(store.people, z.setById)}.`;
    const time = z.endsAt ? `Ends in ${formatRemaining(z.endsAt - now)}.` : 'Until turned off.';
    return { z, detail: `${who === 'You' ? 'You stay' : `${who} stays`} within ${formatDistance(z.radiusM)}. ${time}${by}` };
  });

  const peekSummary = selectedZone
    ? selectedZone.name
    : destination
      ? destination.name
      : `${people.length - 1} sharing with you. ${store.zones.length} ${store.zones.length === 1 ? 'zone' : 'zones'}.`;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FamilyMap
        ref={map}
        initialCenter={store.myCoord}
        initialSpanM={7000}
        people={people}
        zones={store.zones.map((z) => ({ id: z.id, center: z.center, radiusM: z.radiusM, alert: zoneAlert.has(z.id) }))}
        route={route?.coords}
        pin={selection?.kind === 'place' ? selection.place.coord : undefined}
        topInset={insets.top + 60}
        bottomInset={sheetH}
        onLongPress={dropPin}
        onPanDrag={() => snap !== 'peek' && setSnap('peek')}
        onPressPerson={choosePerson}
        onPressZone={chooseZone}
      />

      <BottomSheet
        snap={snap}
        onSnapChange={setSnap}
        onVisibleHeight={setSheetH}
        above={
          <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: space.md }}>
            <SosButton />
            <View style={{ gap: space.sm }}>
              <MapButton icon="crosshair" label="Show me" onPress={() => map.current?.flyTo(store.myCoord, 3000)} />
              <MapButton icon="users" label="Show everyone" onPress={() => map.current?.fitTo(people.map((p) => p.coord))} />
            </View>
          </View>
        }
        header={
          snap === 'peek' ? (
            <Pressable onPress={() => setSnap('half')} style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
              <T v="bodyStrong" numberOfLines={1}>{peekSummary}</T>
            </Pressable>
          ) : null
        }
      >
        {selectedZone ? (
          <ZoneCard
            zoneId={selectedZone.id}
            onClose={() => setSelection(null)}
            onZoomOut={() => map.current?.fitCircle(selectedZone.center, selectedZone.radiusM, 2.6)}
          />
        ) : destination ? (
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
              {selectedPerson && <Avatar name={selectedPerson.name} tint={selectedPerson.tint} size={44} />}
              <View style={{ flex: 1 }}>
                <T v="heading">{selectedPerson ? selectedPerson.name : destination.name}</T>
                <T v="small" color={c.muted}>
                  {selectedPerson
                    ? `${selectedPerson.label}. Location updated ${selectedPerson.locationAt ? formatAgo(selectedPerson.locationAt) : 'recently'}.`
                    : selection?.kind === 'place' && selection.place.address}
                </T>
                <T v="small" color={c.muted}>{formatDistance(distanceMeters(store.myCoord, destination.coord))} from you</T>
              </View>
              <Pressable accessibilityLabel="Close" onPress={() => setSelection(null)} hitSlop={10}>
                <Feather name="x" size={22} color={c.muted} />
              </Pressable>
            </View>

            {route || routeState !== 'idle' ? (
              <View style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {MODES.map((m) => (
                    <Pressable
                      key={m.mode}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: mode === m.mode }}
                      onPress={() => directions(m.mode)}
                      style={{
                        flex: 1,
                        height: 40,
                        borderRadius: 20,
                        flexDirection: 'row',
                        gap: 6,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: mode === m.mode ? c.ink : c.bg,
                      }}
                    >
                      <Feather name={m.icon} size={14} color={mode === m.mode ? c.bg : c.muted} />
                      <T v="smallStrong" color={mode === m.mode ? c.bg : c.ink}>{m.label}</T>
                    </Pressable>
                  ))}
                </View>
                {routeState === 'loading' ? (
                  <ActivityIndicator color={c.beaconText} style={{ marginVertical: space.md }} />
                ) : routeState === 'error' ? (
                  <T v="small" color={c.flare}>Couldn't find a route. Try another way of travelling.</T>
                ) : route ? (
                  <View>
                    <T v="title">
                      {formatDuration(route.durationS)} <T v="body" color={c.muted}>{formatDistance(route.distanceM)}</T>
                    </T>
                    {selectedPerson && <T v="small" color={c.muted}>Updates if {firstName(selectedPerson.name)} moves.</T>}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {!route && routeState === 'idle' && (
                <Button
                  label="Directions"
                  onPress={() => directions()}
                  style={{ flex: 1 }}
                  icon={<Feather name="corner-up-right" size={16} color={c.onBeacon} />}
                />
              )}
              {selectedPerson ? (
                <Button kind="secondary" label="View profile" style={{ flex: 1 }} onPress={() => router.push(`/person/${selectedPerson.id}`)} />
              ) : (
                <Button
                  kind="secondary"
                  label="Make a zone here"
                  style={{ flex: 1 }}
                  onPress={() =>
                    router.push({
                      pathname: '/zone/[id]',
                      params: { id: 'new', lat: String(destination.coord.latitude), lng: String(destination.coord.longitude), name: destination.name },
                    })
                  }
                />
              )}
            </View>
          </View>
        ) : (
          <View style={{ gap: space.lg }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T v="heading">Zones</T>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/zone/[id]',
                      params: { id: 'new', lat: String(store.myCoord.latitude), lng: String(store.myCoord.longitude) },
                    })
                  }
                  hitSlop={10}
                >
                  <T v="smallStrong" color={c.beaconText}>New zone</T>
                </Pressable>
              </View>
              {zoneRows.length === 0 ? (
                <T v="small" color={c.muted} style={{ marginTop: space.xs }}>
                  A zone is a circle someone should stay inside. Search for a place or {Platform.OS === 'web' ? 'click' : 'long-press'} the map to start.
                </T>
              ) : (
                zoneRows.map(({ z, detail }) => (
                  <Pressable
                    key={z.id}
                    onPress={() => chooseZone(z.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.hairline }}
                  >
                    <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: zoneAlert.has(z.id) ? c.flare : c.beacon }} />
                    <View style={{ flex: 1 }}>
                      <T v="bodyStrong">{z.name}</T>
                      <T v="small" color={c.muted}>{detail}</T>
                    </View>
                    <Feather name="chevron-right" size={18} color={c.muted} />
                  </Pressable>
                ))
              )}
            </View>

            <View>
              <T v="heading">Sharing with you</T>
              {people.length === 1 && (
                <T v="small" color={c.muted} style={{ marginTop: space.xs }}>
                  No one is sharing their location with you yet.
                </T>
              )}
              {people.slice(1).map((p) => (
                <Pressable key={p.id} onPress={() => choosePerson(p.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}>
                  <Avatar name={p.name} tint={p.tint} size={32} />
                  <T v="body" style={{ flex: 1 }}>{firstName(p.name)}</T>
                  <T v="small" color={c.muted}>{formatDistance(distanceMeters(store.myCoord, p.coord))} away</T>
                  <Feather name="chevron-right" size={18} color={c.muted} />
                </Pressable>
              ))}
            </View>

            {!hasMapboxToken && (
              <T v="tiny" color={c.muted}>Search and directions use sample Lagos places until a Mapbox token is added.</T>
            )}
          </View>
        )}
      </BottomSheet>

      {/* Search + alerts float over the map */}
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, gap: space.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            backgroundColor: c.surface,
            borderRadius: 26,
            paddingHorizontal: space.md,
            height: 52,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <Feather name="search" size={18} color={c.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search places or people"
            placeholderTextColor={c.muted}
            returnKeyType="search"
            accessibilityLabel="Search places or people"
            style={[type.body, { flex: 1, color: c.ink, height: 52 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as never)]}
          />
          {searching ? (
            <ActivityIndicator color={c.beaconText} />
          ) : query ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={10}>
              <Feather name="x" size={18} color={c.muted} />
            </Pressable>
          ) : null}
        </View>

        {Boolean(query.trim()) && (
          <SearchResults
            query={query}
            places={results}
            searching={searching}
            error={searchError}
            onPlace={choosePlace}
            onPerson={choosePerson}
          />
        )}

        {!query && alerts.map((a) => <AlertBanner key={a.id} alert={a} />)}
      </View>
    </View>
  );
}

/** Places from Mapbox plus people sharing with you whose name matches. */
function SearchResults({
  query,
  places,
  searching,
  error,
  onPlace,
  onPerson,
}: {
  query: string;
  places: Place[];
  searching: boolean;
  error: string;
  onPlace: (p: Place) => void;
  onPerson: (id: string) => void;
}) {
  const c = useColors();
  const store = useStore();
  const q = query.trim().toLowerCase();
  const matches = store.people.filter(
    (p) => p.status === 'connected' && p.theyShare && p.coord && `${p.name} ${p.label}`.toLowerCase().includes(q)
  );
  const empty = !searching && !error && places.length === 0 && matches.length === 0;
  const rows = matches.length + places.length;

  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 18, overflow: 'hidden' }}>
      {matches.map((p, i) => (
        <Row key={p.id} last={i === rows - 1} onPress={() => onPerson(p.id)}>
          <Avatar name={p.name} tint={p.tint} size={28} />
          <View style={{ flex: 1 }}>
            <T v="bodyStrong" numberOfLines={1}>{p.name}</T>
            <T v="small" color={c.muted} numberOfLines={1}>{p.label}, sharing their location</T>
          </View>
        </Row>
      ))}
      {error ? (
        <Row last><T v="small" color={c.flare}>{error}</T></Row>
      ) : empty ? (
        <Row last><T v="small" color={c.muted}>Nothing matches “{query}”. Try a street, area, landmark or a person's name.</T></Row>
      ) : (
        places.map((p, i) => (
          <Row key={p.id} last={matches.length + i === rows - 1} onPress={() => onPlace(p)}>
            <Feather name="map-pin" size={18} color={c.beaconText} />
            <View style={{ flex: 1 }}>
              <T v="bodyStrong" numberOfLines={1}>{p.name}</T>
              <T v="small" color={c.muted} numberOfLines={1}>{p.address}</T>
            </View>
          </Row>
        ))
      )}
    </View>
  );
}

/** A selected zone: who it's for, size, time left, and quick actions. */
function ZoneCard({ zoneId, onClose, onZoomOut }: { zoneId: string; onClose: () => void; onZoomOut: () => void }) {
  const c = useColors();
  const store = useStore();
  const now = useNow();
  const z = store.zones.find((x) => x.id === zoneId);
  if (!z) return null;
  const who = whoName(store.people, z.forId);
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <T v="heading">{z.name}</T>
          <T v="small" color={c.muted}>
            {who === 'You' ? 'You stay' : `${who} stays`} within {formatDistance(z.radiusM)}.{' '}
            {z.endsAt ? `Ends in ${formatRemaining(z.endsAt - now)}.` : 'Until turned off.'}
            {z.setById === 'me' ? '' : ` Set by ${whoName(store.people, z.setById)}.`}
          </T>
        </View>
        <Pressable accessibilityLabel="Close zone" onPress={onClose} hitSlop={10}>
          <Feather name="x" size={22} color={c.muted} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Open zone" style={{ flex: 1 }} onPress={() => router.push(`/zone/${z.id}`)} />
        <Button kind="secondary" label="See around it" style={{ flex: 1 }} onPress={onZoomOut} />
      </View>
    </View>
  );
}

function MapButton({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: c.surface,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <Feather name={icon} size={18} color={c.ink} />
    </Pressable>
  );
}

/** Hold for 2 seconds to send an SOS to everyone you're connected to. */
function SosButton() {
  const c = useColors();
  const store = useStore();
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  const mySos = store.alerts.find((a) => a.forId === 'me' && a.stage === 'sos');

  const start = () => {
    if (mySos) return router.push('/check-in');
    setHolding(true);
    Animated.timing(progress, { toValue: 1, duration: 2000, useNativeDriver: false }).start(({ finished }) => {
      setHolding(false);
      progress.setValue(0);
      if (finished) attempt(store.actions.sosNow(null), () => router.push('/check-in'));
    });
  };
  const cancel = () => {
    progress.stopAnimation();
    progress.setValue(0);
    setHolding(false);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={mySos ? 'SOS active. Open it.' : 'Hold for 2 seconds to send an SOS'}
      onPressIn={start}
      onPressOut={cancel}
      style={{
        height: 52,
        minWidth: 52,
        paddingHorizontal: space.md,
        borderRadius: 26,
        backgroundColor: c.flare,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.25)',
          width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
      <T v="bodyStrong" color="#FFFFFF">{mySos ? 'SOS active' : holding ? 'Keep holding…' : 'Hold for SOS'}</T>
    </Pressable>
  );
}
