import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { MapZone } from './types';

const GROW_MS = 450;
const TICK_MS = 70; // ~14 fps is plenty for slow pulses and keeps the map light
const PULSE_MS = 2400;
const RIPPLE_MS = 1400;

export type ZoneFrame = {
  id: string;
  center: MapZone['center'];
  alert: boolean;
  /** Current (possibly growing) radius in metres. */
  radiusM: number;
  /** Soft outer ring: radius and opacity 0..1. */
  pulse: { radiusM: number; opacity: number };
  /** Red rings spreading out while an alert is open. */
  ripples: { radiusM: number; opacity: number }[];
};

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Drives zone animations: circles grow to their size when created or resized,
 * pulse gently while active, and send out red ripples during an alert.
 * Only the layer using this re-renders on each tick.
 */
export function useZoneFrames(zones: MapZone[]): ZoneFrame[] {
  const [now, setNow] = useState(() => Date.now());
  const [reduce, setReduce] = useState(false);
  const grow = useRef(new Map<string, { from: number; to: number; at: number }>());

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
  }, []);

  // Start a grow whenever a zone appears or its radius changes.
  for (const z of zones) {
    const g = grow.current.get(z.id);
    if (!g) grow.current.set(z.id, { from: 0, to: z.radiusM, at: Date.now() });
    else if (g.to !== z.radiusM) {
      const current = g.from + (g.to - g.from) * easeOut(Math.min(1, (Date.now() - g.at) / GROW_MS));
      grow.current.set(z.id, { from: current, to: z.radiusM, at: Date.now() });
    }
  }

  useEffect(() => {
    if (reduce || zones.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [reduce, zones.length]);

  return zones.map((z) => {
    const g = grow.current.get(z.id)!;
    const t = reduce ? 1 : Math.min(1, (now - g.at) / GROW_MS);
    const radiusM = g.from + (g.to - g.from) * easeOut(t);
    const p = reduce ? 0 : (now % PULSE_MS) / PULSE_MS;
    const ripples = z.alert && !reduce
      ? [0, 0.5].map((offset) => {
          const r = ((now / RIPPLE_MS) + offset) % 1;
          return { radiusM: radiusM * (1 + r * 0.6), opacity: (1 - r) * 0.8 };
        })
      : [];
    return {
      id: z.id,
      center: z.center,
      alert: Boolean(z.alert),
      radiusM,
      pulse: { radiusM: radiusM * (1 + p * 0.08), opacity: reduce ? 0 : (1 - p) * 0.6 },
      ripples,
    };
  });
}

/** Hex colour plus alpha, e.g. withAlpha('#F2B705', 0.4). */
export function withAlpha(hex: string, alpha: number) {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
