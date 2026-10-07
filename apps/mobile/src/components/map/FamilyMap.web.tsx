// Browser stand-in for the native map. react-native-maps doesn't run on web,
// so this draws zones, people, pins and routes on a plain grid. Click = drop pin.

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Avatar, T } from '@/components/ui';
import type { LatLng } from '@/lib/geo';
import { useColors } from '@/theme';
import type { FamilyMapHandle, FamilyMapProps } from './types';
import { useZoneFrames, withAlpha } from './zoneAnim';

const METERS_PER_DEG = 111_320;
const MOVE_MS = 450;

type Camera = { center: LatLng; spanM: number };

export const FamilyMap = forwardRef<FamilyMapHandle, FamilyMapProps>(function FamilyMap(
  { style, initialCenter, initialSpanM = 6000, people = [], zones = [], route, routes = [], markers = [], pin, topInset = 0, bottomInset = 0, onLongPress, onPressPerson, onPressZone },
  ref
) {
  const c = useColors();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [camera, setCamera] = useState<Camera>({ center: initialCenter, spanM: initialSpanM });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const frames = useZoneFrames(zones);

  // Smoothly animate the camera, like the native map does.
  const moveTo = (target: Camera) => {
    const from = cameraRef.current;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / MOVE_MS);
      const e = 1 - Math.pow(1 - k, 3);
      setCamera({
        center: {
          latitude: from.center.latitude + (target.center.latitude - from.center.latitude) * e,
          longitude: from.center.longitude + (target.center.longitude - from.center.longitude) * e,
        },
        spanM: from.spanM + (target.spanM - from.spanM) * e,
      });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const usableH = Math.max(1, size.h - topInset - bottomInset);
  const minSide = Math.max(1, Math.min(size.w, usableH));
  const mpp = camera.spanM / minSide; // metres per pixel
  const cosLat = Math.cos((camera.center.latitude * Math.PI) / 180);
  const cy = topInset + usableH / 2;
  const toXY = (p: LatLng) => ({
    x: size.w / 2 + ((p.longitude - camera.center.longitude) * METERS_PER_DEG * cosLat) / mpp,
    y: cy - ((p.latitude - camera.center.latitude) * METERS_PER_DEG) / mpp,
  });
  const toLatLng = (x: number, y: number): LatLng => ({
    latitude: camera.center.latitude - ((y - cy) * mpp) / METERS_PER_DEG,
    longitude: camera.center.longitude + ((x - size.w / 2) * mpp) / (METERS_PER_DEG * cosLat),
  });

  useImperativeHandle(ref, () => ({
    flyTo: (center, spanM = 3000) => moveTo({ center, spanM }),
    fitTo: (coords) => {
      if (!coords.length) return;
      const lats = coords.map((p) => p.latitude);
      const lngs = coords.map((p) => p.longitude);
      const center = { latitude: (Math.min(...lats) + Math.max(...lats)) / 2, longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
      const spanLat = (Math.max(...lats) - Math.min(...lats)) * METERS_PER_DEG;
      const spanLng = (Math.max(...lngs) - Math.min(...lngs)) * METERS_PER_DEG * Math.cos((center.latitude * Math.PI) / 180);
      moveTo({ center, spanM: Math.max(800, Math.max(spanLat, spanLng) * 1.4) });
    },
    fitCircle: (center, radiusM, margin = 1.15) => {
      // Make the circle's diameter fill the narrower usable side.
      const w = Math.max(1, size.w - 48);
      const h = Math.max(1, usableH - 48);
      const metresPerPx = (radiusM * margin * 2) / Math.min(w, h);
      moveTo({ center, spanM: metresPerPx * minSide });
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
              {frames.map((f) => {
                const { x, y } = toXY(f.center);
                const tone = f.alert ? c.flare : c.beacon;
                return [
                  ...f.ripples.map((r, i) => (
                    <Circle key={`${f.id}r${i}`} cx={x} cy={y} r={r.radiusM / mpp} stroke={withAlpha(c.flare, r.opacity)} strokeWidth={2} fill="none" />
                  )),
                  <Circle key={`${f.id}p`} cx={x} cy={y} r={f.pulse.radiusM / mpp} stroke={withAlpha(tone, f.pulse.opacity)} strokeWidth={2} fill="none" />,
                  <Circle
                    key={f.id}
                    cx={x}
                    cy={y}
                    r={f.radiusM / mpp}
                    stroke={tone}
                    strokeWidth={3}
                    fill={withAlpha(tone, 0.16)}
                    onPress={onPressZone ? () => onPressZone(f.id) : undefined}
                  />,
                ];
              })}
              {route && route.length > 1 && (
                <Polyline
                  points={route.map((p) => { const { x, y } = toXY(p); return `${x},${y}`; }).join(' ')}
                  stroke={c.beaconText}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}
              {routes.map((r) =>
                r.coords.length > 1 ? (
                  <Polyline
                    key={r.id}
                    points={r.coords.map((p) => { const { x, y } = toXY(p); return `${x},${y}`; }).join(' ')}
                    stroke={r.muted ? withAlpha(c.beaconText, 0.55) : c.beaconText}
                    strokeWidth={r.muted ? 4 : 6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ) : null
              )}
              {markers.map((m) => {
                const { x, y } = toXY(m.coord);
                return <Circle key={m.id} cx={x} cy={y} r={11} fill={m.kind === 'roadblock' ? c.flare : c.ink} stroke="#FFFFFF" strokeWidth={3} />;
              })}
              {pin && <Circle cx={toXY(pin).x} cy={toXY(pin).y} r={8} fill={c.beacon} stroke="#FFFFFF" strokeWidth={3} />}
            </Svg>
          </Pressable>

          {people.map((p) => {
            const { x, y } = toXY(p.coord);
            return (
              <Pressable
                key={p.id}
                onPress={() => onPressPerson?.(p.id)}
                style={{ position: 'absolute', left: x - 20, top: y - 20, padding: 3, borderRadius: 24, backgroundColor: p.alert ? c.flare : '#FFFFFF', opacity: p.stale ? 0.5 : 1 }}
              >
                <Avatar name={p.name} tint={p.tint} size={34} />
              </Pressable>
            );
          })}

          <View style={{ position: 'absolute', left: 8, top: topInset + 8, backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <T v="tiny" color={c.muted}>Map preview. Open on a phone for the real map.</T>
          </View>
        </>
      )}
    </View>
  );
});
