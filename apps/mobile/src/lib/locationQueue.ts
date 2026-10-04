import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/** One GPS reading as sent to report_locations(). */
export type Point = { lat: number; lng: number; acc: number | null; t: string };

const MAX_QUEUED = 2000; // ~8 hours at one point every 15 s
const key = (userId: string) => `location-queue:${userId}`;

async function readQueue(userId: string): Promise<Point[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(key(userId))) ?? '[]');
  } catch {
    return [];
  }
}

async function writeQueue(userId: string, points: Point[]) {
  try {
    if (points.length === 0) await AsyncStorage.removeItem(key(userId));
    else await AsyncStorage.setItem(key(userId), JSON.stringify(points.slice(-MAX_QUEUED)));
  } catch {
    // Storage full or unavailable: the live point is still attempted.
  }
}

/**
 * Sends a point together with anything saved while offline. If the upload
 * fails, everything stays queued on the phone and goes up next time.
 * Returns how many points are still waiting.
 */
export async function sendPoint(userId: string, point: Point): Promise<number> {
  if (!supabase) return 0;
  const batch = [...(await readQueue(userId)), point];
  const { error } = await supabase.rpc('report_locations', { points: batch });
  if (error) {
    await writeQueue(userId, batch);
    return Math.min(batch.length, MAX_QUEUED);
  }
  await writeQueue(userId, []);
  return 0;
}
