import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';

export type RecordingGroup = {
  alertId: string;
  forUser: string;
  title: string | null;
  kind: 'zone' | 'manual';
  zoneName: string | null;
  sosAt: number | null;
  startedAt: number;
  clipCount: number;
  totalMs: number;
};

export type Clip = { id: string; path: string; url: string; createdAt: number; durationMs: number | null };

/** Every SOS with audio that you can see: yours and ones you watched. */
export async function listRecordingGroups(): Promise<RecordingGroup[]> {
  const db = supabase!;
  const { data: rows, error } = await db
    .from('sos_recordings')
    .select('alert_id, duration_ms, created_at, alerts!inner(id, for_user, title, kind, zone_name, sos_at, left_at)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const groups = new Map<string, RecordingGroup>();
  for (const r of rows as any[]) {
    const a = r.alerts;
    const g = groups.get(r.alert_id) ?? {
      alertId: r.alert_id,
      forUser: a.for_user,
      title: a.title,
      kind: a.kind,
      zoneName: a.zone_name,
      sosAt: a.sos_at ? Date.parse(a.sos_at) : null,
      startedAt: Date.parse(a.sos_at ?? a.left_at),
      clipCount: 0,
      totalMs: 0,
    };
    g.clipCount += 1;
    g.totalMs += r.duration_ms ?? 0;
    groups.set(r.alert_id, g);
  }
  return [...groups.values()].sort((a, b) => b.startedAt - a.startedAt);
}

export async function listClips(alertId: string): Promise<Clip[]> {
  const db = supabase!;
  const { data, error } = await db
    .from('sos_recordings')
    .select('id, path, duration_ms, created_at')
    .eq('alert_id', alertId)
    .order('created_at');
  if (error) throw new Error(error.message);
  if (!data?.length) return [];
  const signed = await db.storage.from('sos-recordings').createSignedUrls(data.map((r) => r.path), 3600);
  return data.map((r, i) => ({
    id: r.id,
    path: r.path,
    url: signed.data?.[i]?.signedUrl ?? '',
    createdAt: Date.parse(r.created_at),
    durationMs: r.duration_ms,
  }));
}

/** A readable default name, e.g. "SOS near Campus, Tue 30 Sep, 9:14 PM". */
export function defaultTitle(g: Pick<RecordingGroup, 'kind' | 'zoneName' | 'startedAt'>): string {
  const when = new Date(g.startedAt).toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  return g.kind === 'zone' && g.zoneName ? `SOS near ${g.zoneName}, ${when}` : `SOS, ${when}`;
}

/** Downloads a clip and opens the share sheet so it can be saved to Files or sent. */
export async function saveClipToPhone(clip: Clip, name: string) {
  const ext = clip.path.split('.').pop() ?? 'm4a';
  const safe = name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'sos-recording';
  const destination = new File(Paths.cache, `${safe}.${ext}`);
  if (destination.exists) destination.delete();
  const file = await File.downloadFileAsync(clip.url, destination);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Saving files is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`, dialogTitle: name, UTI: 'public.audio' });
}
