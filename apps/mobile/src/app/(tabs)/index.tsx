import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertBanner } from '@/components/AlertBanner';
import { FamilyMap } from '@/components/map/FamilyMap';
import type { FamilyMapHandle, MapPerson } from '@/components/map/types';
import { Avatar, Button, Row, T } from '@/components/ui';
import { distanceMeters, formatDistance, formatDuration, type LatLng } from '@/lib/geo';
import { addressAt, getRoute, hasMapboxToken, searchPlaces, type Place, type Route, type TravelMode } from '@/lib/mapbox';
import { activeAlerts, firstName, formatRemaining, useNow, useStore, whoName } from '@/state/store';
import { space, type, useColors } from '@/theme';

const MODES: { mode: TravelMode; label: string; icon: 'navigation' | 'truck' | 'wind' }[] = [
  { mode: 'walking', label: 'Walk', icon: 'navigation' },
  { mode: 'driving', label: 'Car', icon: 'truck' },
  { mode: 'cycling', label: 'Bike', icon: 'wind' },
];

export default function MapScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const now = useNow();
  const map = useRef<FamilyMapHandle>(null);

  const [full, setFull] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState<Place | null>(null);
  const [mode, setMode] = useState<TravelMode>('driving');
  const [route, setRoute] = useState<Route | null>(null);
  const [routeState, setRouteState] = useState<'idle' | 'loading' | 'error'>('idle');

  const alerts = activeAlerts(store.alerts);
  const alertFor = new Set(alerts.map((a) => a.forId));
  const zoneAlert = new Set(alerts.map((a) => a.zoneId));

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
      } catch (e) {
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

  const toggleFull = (value = !full) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFull(value);
  };

  const choose = (place: Place) => {
    setSelected(place);
    setRoute(null);
    setRouteState('idle');
    setQuery('');
    setResults([]);
    map.current?.flyTo(place.coord, 2500);
    if (full) toggleFull(false);
  };

  const dropPin = async (coord: LatLng) => {
    setSelected({ id: 'pending', name: 'Dropped pin', address: 'Finding address…', coord });
    setRoute(null);
    choose(await addressAt(coord));
  };

  const directions = async (m: TravelMode = mode) => {
    if (!selected) return;
    setMode(m);
    setRouteState('loading');
    try {
      const r = await getRoute(store.myCoord, selected.coord, m);
      setRoute(r);
      setRouteState('idle');
      map.current?.fitTo(r.coords);
    } catch {
      setRouteState('error');
    }
  };

  const clearPlace = () => {
    setSelected(null);
    setRoute(null);
  };

  const zoneRows = store.zones.map((z) => {
    const who = whoName(store.people, z.forId);
    const by = z.setById === 'me' ? '' : ` Set by ${whoName(store.people, z.setById)}.`;
    const time = z.endsAt ? `Ends in ${formatRemaining(z.endsAt - now)}.` : 'Until turned off.';
    return { z, who, detail: `${who === 'You' ? 'You stay' : `${who} stays`} within ${formatDistance(z.radiusM)}. ${time}${by}` };
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: full ? 1 : 0.55 }}>
        <FamilyMap
          ref={map}
          initialCenter={store.myCoord}
          initialSpanM={7000}
          people={people}
          zones={store.zones.map((z) => ({ id: z.id, center: z.center, radiusM: z.radiusM, alert: zoneAlert.has(z.id) }))}
          route={route?.coords}
          pin={selected?.coord}
          topInset={insets.top + 60}
          onLongPress={dropPin}
          onPressPerson={(id) => (id === 'me' ? null : router.push(`/person/${id}`))}
          onPressZone={(id) => router.push(`/zone/${id}`)}
        />

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
              placeholder="Search places in Lagos"
              placeholderTextColor={c.muted}
              returnKeyType="search"
              accessibilityLabel="Search places"
              style={[type.body, { flex: 1, color: c.ink, height: 52 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as never)]}
            />
            {searching ? (
              <ActivityIndicator color={c.beacon} />
            ) : query ? (
              <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={10}>
                <Feather name="x" size={18} color={c.muted} />
              </Pressable>
            ) : null}
          </View>

          {(results.length > 0 || Boolean(searchError) || (Boolean(query.trim()) && !searching)) && (
            <View style={{ backgroundColor: c.surface, borderRadius: 18, overflow: 'hidden' }}>
              {searchError ? (
                <Row last><T v="small" color={c.flare}>{searchError}</T></Row>
              ) : results.length === 0 ? (
                <Row last><T v="small" color={c.muted}>No places match “{query}”. Try a street, area or landmark.</T></Row>
              ) : (
                results.map((p, i) => (
                  <Row key={p.id} last={i === results.length - 1} onPress={() => choose(p)}>
                    <Feather name="map-pin" size={18} color={c.beacon} />
                    <View style={{ flex: 1 }}>
                      <T v="bodyStrong" numberOfLines={1}>{p.name}</T>
                      <T v="small" color={c.muted} numberOfLines={1}>{p.address}</T>
                    </View>
                  </Row>
                ))
              )}
            </View>
          )}

          {!query && alerts.map((a) => <AlertBanner key={a.id} alert={a} />)}
        </View>

        {/* Map controls */}
        <View style={{ position: 'absolute', right: space.md, bottom: full ? space.md : space.md + 20, gap: space.sm }}>
          <MapButton icon="crosshair" label="Show me" onPress={() => map.current?.flyTo(store.myCoord, 3000)} />
          <MapButton icon="users" label="Show everyone" onPress={() => map.current?.fitTo(people.map((p) => p.coord))} />
          <MapButton icon={full ? 'minimize-2' : 'maximize-2'} label={full ? 'Shrink map' : 'Full screen map'} onPress={() => toggleFull()} />
        </View>
      </View>

      {/* Bottom panel */}
      <View style={{ flex: full ? 0 : 0.45, backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={full ? 'Show details' : 'Hide details'}
          onPress={() => toggleFull()}
          style={{ alignItems: 'center', paddingVertical: 10 }}
        >
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.hairline }} />
        </Pressable>

        {full ? (
          <Pressable onPress={() => toggleFull(false)} style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
            <T v="smallStrong" color={c.muted}>
              {selected ? selected.name : `${people.length - 1} sharing with you. ${store.zones.length} zones.`}
            </T>
          </Pressable>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.xl }}>
            {selected ? (
              <View style={{ gap: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <T v="heading">{selected.name}</T>
                    <T v="small" color={c.muted}>{selected.address}</T>
                    <T v="small" color={c.muted}>{formatDistance(distanceMeters(store.myCoord, selected.coord))} from you</T>
                  </View>
                  <Pressable accessibilityLabel="Close place" onPress={clearPlace} hitSlop={10}>
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
                      <ActivityIndicator color={c.beacon} style={{ marginVertical: space.md }} />
                    ) : routeState === 'error' ? (
                      <T v="small" color={c.flare}>Couldn't find a route. Try another way of travelling.</T>
                    ) : route ? (
                      <T v="title">
                        {formatDuration(route.durationS)} <T v="body" color={c.muted}>{formatDistance(route.distanceM)}</T>
                      </T>
                    ) : null}
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {!route && routeState === 'idle' && (
                    <Button label="Directions" onPress={() => directions()} style={{ flex: 1 }} icon={<Feather name="corner-up-right" size={16} color={c.onBeacon} />} />
                  )}
                  <Button
                    kind="secondary"
                    label="Make a zone here"
                    style={{ flex: 1 }}
                    onPress={() =>
                      router.push({
                        pathname: '/zone/[id]',
                        params: { id: 'new', lat: String(selected.coord.latitude), lng: String(selected.coord.longitude), name: selected.name },
                      })
                    }
                  />
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
                      <T v="smallStrong" color={c.beacon}>New zone</T>
                    </Pressable>
                  </View>
                  {zoneRows.length === 0 ? (
                    <T v="small" color={c.muted} style={{ marginTop: space.xs }}>
                      A zone is a circle someone should stay inside. Search for a place or {Platform.OS === 'web' ? 'click' : 'long-press'} the map to start.
                    </T>
                  ) : (
                    zoneRows.map(({ z, detail }) => (
                      <Pressable key={z.id} onPress={() => router.push(`/zone/${z.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.hairline }}>
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
                  {people.slice(1).map((p) => (
                    <Pressable key={p.id} onPress={() => map.current?.flyTo(p.coord, 1500)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}>
                      <Avatar name={p.name} tint={p.tint} size={32} />
                      <T v="body" style={{ flex: 1 }}>{firstName(p.name)}</T>
                      <T v="small" color={c.muted}>{formatDistance(distanceMeters(store.myCoord, p.coord))} away</T>
                    </Pressable>
                  ))}
                </View>

                {store.zones.length > 0 && (
                  <View style={{ gap: space.sm }}>
                    <T v="heading">Try the alerts</T>
                    <T v="small" color={c.muted}>Demo only. Timers run fast: each minute of waiting takes one second.</T>
                    {store.zones.map((z) => (
                      <Button
                        key={z.id}
                        kind="secondary"
                        label={z.forId === 'me' ? `You leave ${z.name}` : `${whoName(store.people, z.forId)} leaves ${z.name}`}
                        disabled={zoneAlert.has(z.id)}
                        onPress={() => store.dispatch({ type: 'simulateLeave', zoneId: z.id, now: Date.now() })}
                      />
                    ))}
                  </View>
                )}

                {!hasMapboxToken && (
                  <T v="tiny" color={c.muted}>
                    Search and directions use sample Lagos places until a Mapbox token is added.
                  </T>
                )}
              </View>
            )}
          </ScrollView>
        )}
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
