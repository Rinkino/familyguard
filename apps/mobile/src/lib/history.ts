import { distanceMeters, type LatLng } from './geo';
import { supabase } from './supabase';

export type HistoryPoint = { coord: LatLng; at: number };

export type TimelineItem =
  | { kind: 'stop'; center: LatLng; from: number; to: number }
  | { kind: 'moving'; from: number; to: number; distanceM: number }
  | { kind: 'gap'; from: number; to: number };

const STOP_RADIUS_M = 150;
const STOP_MIN_MS = 10 * 60_000;
const GAP_MS = 30 * 60_000;

export async function loadHistory(userId: string, sinceMs: number, untilMs = Date.now()): Promise<HistoryPoint[]> {
  const { data, error } = await supabase!
    .from('location_history')
    .select('lat, lng, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', new Date(sinceMs).toISOString())
    .lte('recorded_at', new Date(untilMs).toISOString())
    .order('recorded_at')
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ coord: { latitude: r.lat, longitude: r.lng }, at: Date.parse(r.recorded_at) }));
}

/**
 * Turns raw points into a readable timeline: places they stayed 10+ minutes,
 * stretches of moving, and gaps where the phone sent nothing for 30+ minutes
 * (off, out of signal, or the app closed).
 */
export function buildTimeline(points: HistoryPoint[]): TimelineItem[] {
  const items: TimelineItem[] = [];

  const addMoving = (from: number, to: number, distanceM: number) => {
    const last = items[items.length - 1];
    if (last?.kind === 'moving') {
      last.to = to;
      last.distanceM += distanceM;
    } else items.push({ kind: 'moving', from, to, distanceM });
  };

  // Within one unbroken run of points, find stops and the moving in between.
  const processRun = (run: HistoryPoint[]) => {
    let i = 0;
    while (i < run.length) {
      let j = i;
      while (j + 1 < run.length && distanceMeters(run[i].coord, run[j + 1].coord) <= STOP_RADIUS_M) j++;
      if (run[j].at - run[i].at >= STOP_MIN_MS) {
        const cluster = run.slice(i, j + 1);
        items.push({
          kind: 'stop',
          center: {
            latitude: cluster.reduce((sum, p) => sum + p.coord.latitude, 0) / cluster.length,
            longitude: cluster.reduce((sum, p) => sum + p.coord.longitude, 0) / cluster.length,
          },
          from: run[i].at,
          to: run[j].at,
        });
        i = j + 1;
      } else {
        const next = Math.min(i + 1, run.length - 1);
        addMoving(run[i].at, run[next].at, next > i ? distanceMeters(run[i].coord, run[next].coord) : 0);
        i += 1;
      }
    }
  };

  let start = 0;
  for (let k = 1; k <= points.length; k++) {
    if (k === points.length || points[k].at - points[k - 1].at >= GAP_MS) {
      processRun(points.slice(start, k));
      if (k < points.length) items.push({ kind: 'gap', from: points[k - 1].at, to: points[k].at });
      start = k;
    }
  }
  return items;
}
