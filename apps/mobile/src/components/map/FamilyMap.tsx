// Native map: Apple Maps on iOS, Google Maps on Android (react-native-maps).
// Screens only use this wrapper, so swapping to the Mapbox SDK later only
// touches this file. The browser preview uses FamilyMap.web.tsx instead.

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { Avatar } from '@/components/ui';
import type { LatLng } from '@/lib/geo';
import { useColors } from '@/theme';
import type { FamilyMapHandle, FamilyMapProps } from './types';

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

export const FamilyMap = forwardRef<FamilyMapHandle, FamilyMapProps>(function FamilyMap(
  { style, initialCenter, initialSpanM = 6000, people = [], zones = [], route, pin, topInset = 0, onLongPress, onPressPerson, static: isStatic },
  ref
) {
  const c = useColors();
  const map = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (coord, spanM = 3000) => map.current?.animateToRegion(regionFor(coord, spanM), 450),
    fitTo: (coords) =>
      map.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60 + topInset, right: 50, bottom: 60, left: 50 },
        animated: true,
      }),
  }));

  return (
    <MapView
      ref={map}
      style={[{ flex: 1 }, style]}
      initialRegion={regionFor(initialCenter, initialSpanM)}
      onLongPress={(e) => onLongPress?.(e.nativeEvent.coordinate)}
      scrollEnabled={!isStatic}
      zoomEnabled={!isStatic}
      rotateEnabled={false}
      pitchEnabled={false}
      showsPointsOfInterests
      showsCompass={false}
      toolbarEnabled={false}
    >
      {zones.map((z) => (
        <Circle
          key={`${z.id}-${z.radiusM}-${z.alert ? 'a' : 'n'}`}
          center={z.center}
          radius={z.radiusM}
          strokeWidth={2}
          strokeColor={z.alert ? c.flare : c.beacon}
          fillColor={z.alert ? 'rgba(228,87,46,0.12)' : 'rgba(47,107,79,0.12)'}
        />
      ))}

      {route && route.length > 1 && (
        <Polyline coordinates={route} strokeColor={c.beacon} strokeWidth={5} lineCap="round" lineJoin="round" />
      )}

      {pin && <Marker coordinate={pin} pinColor={c.beacon} />}

      {people.map((p) => (
        <Marker key={p.id} coordinate={p.coord} anchor={{ x: 0.5, y: 0.5 }} onPress={() => onPressPerson?.(p.id)}>
          <View style={{ padding: 3, borderRadius: 24, backgroundColor: p.alert ? c.flare : '#FFFFFF' }}>
            <Avatar name={p.name} tint={p.tint} size={34} />
          </View>
        </Marker>
      ))}
    </MapView>
  );
});
