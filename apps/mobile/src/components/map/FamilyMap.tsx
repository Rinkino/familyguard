// Native map: Apple Maps on iOS, Google Maps on Android (react-native-maps).
// Screens only use this wrapper, so swapping to the Mapbox SDK later only
// touches this file. The browser preview uses FamilyMap.web.tsx instead.

import { forwardRef, Fragment, memo, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { Avatar } from '@/components/ui';
import { offset, type LatLng } from '@/lib/geo';
import { useColors } from '@/theme';
import { Feather } from '@expo/vector-icons';
import type { FamilyMapHandle, FamilyMapProps, MapMarker, MapZone } from './types';
import { useZoneFrames, withAlpha } from './zoneAnim';

const METERS_PER_DEG = 111_320;

function regionFor(center: LatLng, spanM: number) {
  const latDelta = spanM / METERS_PER_DEG;
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: latDelta,
    longitudeDelta: latDelta / Math.cos((center.latitude * Math.PI) / 180),
  };
}

/** Zones with grow, pulse and alert-ripple animation. Re-renders on its own ticker. */
const ZoneLayer = memo(function ZoneLayer({ zones }: { zones: MapZone[] }) {
  const c = useColors();
  const frames = useZoneFrames(zones);
  return (
    <>
      {frames.map((f) => {
        const tone = f.alert ? c.flare : c.beacon;
        return (
          <Fragment key={f.id}>
            {f.ripples.map((r, i) => (
              <Circle
                key={`r${i}`}
                center={f.center}
                radius={r.radiusM}
                strokeWidth={2}
                strokeColor={withAlpha(c.flare, r.opacity)}
                fillColor="transparent"
              />
            ))}
            <Circle
              center={f.center}
              radius={f.pulse.radiusM}
              strokeWidth={4}
              strokeColor={withAlpha(tone, f.pulse.opacity)}
              fillColor="transparent"
            />
            <Circle
              center={f.center}
              radius={f.radiusM}
              strokeWidth={3}
              strokeColor={tone}
              fillColor={withAlpha(tone, 0.16)}
            />
          </Fragment>
        );
      })}
    </>
  );
});

/** Round badge for a destination flag or a user-reported roadblock. */
function MarkerBadge({ kind }: { kind: MapMarker['kind'] }) {
  const c = useColors();
  const roadblock = kind === 'roadblock';
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: roadblock ? c.flare : c.ink,
        borderWidth: 3,
        borderColor: '#FFFFFF',
      }}
    >
      <Feather name={roadblock ? 'alert-octagon' : 'flag'} size={14} color="#FFFFFF" />
    </View>
  );
}

export const FamilyMap = forwardRef<FamilyMapHandle, FamilyMapProps>(function FamilyMap(
  {
    style,
    initialCenter,
    initialSpanM = 6000,
    people = [],
    zones = [],
    route,
    routes = [],
    markers = [],
    pin,
    topInset = 0,
    bottomInset = 0,
    onLongPress,
    onPanDrag,
    onPressPerson,
    static: isStatic,
  },
  ref
) {
  const c = useColors();
  const map = useRef<MapView>(null);
  const padding = { top: 40 + topInset, right: 24, bottom: 24 + bottomInset, left: 24 };

  useImperativeHandle(ref, () => ({
    flyTo: (coord, spanM = 3000) => map.current?.animateToRegion(regionFor(coord, spanM), 450),
    fitTo: (coords) => map.current?.fitToCoordinates(coords, { edgePadding: { ...padding, top: padding.top + 20 }, animated: true }),
    fitCircle: (center, radiusM, margin = 1.15) => {
      const r = radiusM * margin;
      const edge = [0, 90, 180, 270].map((bearing) => offset(center, r, bearing));
      map.current?.fitToCoordinates(edge, { edgePadding: padding, animated: true });
    },
  }));

  return (
    <MapView
      ref={map}
      style={[{ flex: 1 }, style]}
      initialRegion={regionFor(initialCenter, initialSpanM)}
      onLongPress={(e) => onLongPress?.(e.nativeEvent.coordinate)}
      onPanDrag={onPanDrag ? () => onPanDrag() : undefined}
      scrollEnabled={!isStatic}
      zoomEnabled={!isStatic}
      rotateEnabled={false}
      pitchEnabled={false}
      showsPointsOfInterests
      showsCompass={false}
      toolbarEnabled={false}
    >
      <ZoneLayer zones={zones} />

      {route && route.length > 1 && (
        <Polyline coordinates={route} strokeColor={c.beaconText} strokeWidth={5} lineCap="round" lineJoin="round" />
      )}

      {routes.map((r) =>
        r.coords.length > 1 ? (
          <Polyline
            key={r.id}
            coordinates={r.coords}
            strokeColor={r.muted ? withAlpha(c.beaconText, 0.55) : c.beaconText}
            strokeWidth={r.muted ? 4 : 6}
            lineCap="round"
            lineJoin="round"
          />
        ) : null
      )}

      {markers.map((m) => (
        <Marker key={m.id} coordinate={m.coord} anchor={{ x: 0.5, y: 0.5 }} title={m.title}>
          <MarkerBadge kind={m.kind} />
        </Marker>
      ))}

      {pin && <Marker coordinate={pin} pinColor={c.beacon} />}

      {people.map((p) => (
        <Marker key={p.id} coordinate={p.coord} anchor={{ x: 0.5, y: 0.5 }} onPress={() => onPressPerson?.(p.id)}>
          <View style={{ padding: 3, borderRadius: 24, backgroundColor: p.alert ? c.flare : '#FFFFFF', opacity: p.stale ? 0.5 : 1 }}>
            <Avatar name={p.name} tint={p.tint} size={34} />
          </View>
        </Marker>
      ))}
    </MapView>
  );
});
