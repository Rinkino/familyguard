// Browser stand-in for the native map. react-native-maps doesn't run on web,
// so this draws zones, people, pins and routes on a plain grid. Click = drop pin.

import { forwardRef, useImperativeHandle, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Avatar, T } from '@/components/ui';
import type { LatLng } from '@/lib/geo';
import { useColors } from '@/theme';
import type { FamilyMapHandle, FamilyMapProps } from './types';

const METERS_PER_DEG = 111_320;

export const FamilyMap = forwardRef<FamilyMapHandle, FamilyMapProps>(function FamilyMap(
  { style, initialCenter, initialSpanM = 6000, people = [], zones = [], route, pin, onLongPress, onPressPerson, onPressZone },
  ref
) {
  const c = useColors();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [camera, setCamera] = useState({ center: initialCenter, spanM: initialSpanM });

  const mpp = camera.spanM / Math.max(1, Math.min(size.w, size.h)); // metres per pixel
  const cosLat = Math.cos((camera.center.latitude * Math.PI) / 180);
  const toXY = (p: LatLng) => ({
    x: size.w / 2 + ((p.longitude - camera.center.longitude) * METERS_PER_DEG * cosLat) / mpp,
    y: size.h / 2 - ((p.latitude - camera.center.latitude) * METERS_PER_DEG) / mpp,
  });
  const toLatLng = (x: number, y: number): LatLng => ({
    latitude: camera.center.latitude - ((y - size.h / 2) * mpp) / METERS_PER_DEG,
    longitude: camera.center.longitude + ((x - size.w / 2) * mpp) / (METERS_PER_DEG * cosLat),
  });

  useImperativeHandle(ref, () => ({
    flyTo: (center, spanM = 3000) => setCamera({ center, spanM }),
    fitTo: (coords) => {
      if (!coords.length) return;
      const lats = coords.map((p) => p.latitude);
      const lngs = coords.map((p) => p.longitude);
      const center = { latitude: (Math.min(...lats) + Math.max(...lats)) / 2, longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
      const spanLat = (Math.max(...lats) - Math.min(...lats)) * METERS_PER_DEG;
      const spanLng = (Math.max(...lngs) - Math.min(...lngs)) * METERS_PER_DEG * Math.cos((center.latitude * Math.PI) / 180);
      setCamera({ center, spanM: Math.max(800, Math.max(spanLat, spanLng) * 1.5) });
    },
  }));

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const gridStep = 40;

  return (
    <View style={[{ flex: 1, backgroundColor: c.beaconSoft, overflow: 'hidden' }, style]} onLayout={onLayout}>
      {size.w > 0 && (
        <>
          <Pressable
            style={{ position: 'absolute', inset: 0 } as never}
            onPress={(e) => onLongPress?.(toLatLng(e.nativeEvent.locationX, e.nativeEvent.locationY))}
          >
            <Svg width={size.w} height={size.h}>
              {Array.from({ length: Math.ceil(size.w / gridStep) }).map((_, i) => (
                <Line key={`v${i}`} x1={i * gridStep} y1={0} x2={i * gridStep} y2={size.h} stroke={c.hairline} strokeWidth={1} />
              ))}
              {Array.from({ length: Math.ceil(size.h / gridStep) }).map((_, i) => (
                <Line key={`h${i}`} x1={0} y1={i * gridStep} x2={size.w} y2={i * gridStep} stroke={c.hairline} strokeWidth={1} />
              ))}
              {zones.map((z) => {
                const { x, y } = toXY(z.center);
                return (
                  <Circle
                    key={z.id}
                    cx={x}
                    cy={y}
                    r={z.radiusM / mpp}
                    stroke={z.alert ? c.flare : c.beacon}
                    strokeWidth={2}
                    fill={z.alert ? 'rgba(228,87,46,0.12)' : 'rgba(47,107,79,0.12)'}
                    onPress={onPressZone ? () => onPressZone(z.id) : undefined}
                  />
                );
              })}
              {route && route.length > 1 && (
                <Polyline
                  points={route.map((p) => { const { x, y } = toXY(p); return `${x},${y}`; }).join(' ')}
                  stroke={c.beacon}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}
              {pin && <Circle cx={toXY(pin).x} cy={toXY(pin).y} r={8} fill={c.beacon} stroke="#FFFFFF" strokeWidth={3} />}
            </Svg>
          </Pressable>

          {people.map((p) => {
            const { x, y } = toXY(p.coord);
            return (
              <Pressable
                key={p.id}
                onPress={() => onPressPerson?.(p.id)}
                style={{ position: 'absolute', left: x - 20, top: y - 20, padding: 3, borderRadius: 24, backgroundColor: p.alert ? c.flare : '#FFFFFF' }}
              >
                <Avatar name={p.name} tint={p.tint} size={34} />
              </Pressable>
            );
          })}

          <View style={{ position: 'absolute', left: 8, bottom: 28, backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <T v="tiny" color={c.muted}>Map preview. Open on a phone for the real map.</T>
          </View>
        </>
      )}
    </View>
  );
});
