import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { space, useColors } from '@/theme';
import { T } from './ui';

type Clip = { id: string; url: string; createdAt: number; durationMs: number | null };

/** Audio clips recorded during an SOS, newest last. Refreshes every 15 s. */
export function SosClips({ alertId }: { alertId: string }) {
  const c = useColors();
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const load = async () => {
      const { data, error: e } = await supabase!
        .from('sos_recordings')
        .select('id, path, duration_ms, created_at')
        .eq('alert_id', alertId)
        .order('created_at');
      if (e) return !cancelled && setError(e.message);
      if (!data?.length) return !cancelled && setClips([]);
      const signed = await supabase!.storage.from('sos-recordings').createSignedUrls(data.map((r) => r.path), 3600);
      if (cancelled) return;
      setClips(
        data.map((r, i) => ({
          id: r.id,
          url: signed.data?.[i]?.signedUrl ?? '',
          createdAt: Date.parse(r.created_at),
          durationMs: r.duration_ms,
        }))
      );
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [alertId]);

  if (error) return <T v="small" color={c.flare}>Couldn't load audio: {error}</T>;
  if (!clips) return <ActivityIndicator color={c.beacon} />;
  if (clips.length === 0) return <T v="small" color={c.muted}>No audio yet. Clips arrive every 30 seconds while recording.</T>;

  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 18, overflow: 'hidden' }}>
      {clips.map((clip, i) => (
        <ClipRow key={clip.id} clip={clip} index={i + 1} last={i === clips.length - 1} />
      ))}
    </View>
  );
}

function ClipRow({ clip, index, last }: { clip: Clip; index: number; last: boolean }) {
  const c = useColors();
  const player = useAudioPlayer(clip.url);
  const status = useAudioPlayerStatus(player);
  const time = new Date(clip.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const secs = clip.durationMs ? Math.round(clip.durationMs / 1000) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${status.playing ? 'Pause' : 'Play'} clip ${index}`}
      onPress={() => {
        if (status.playing) player.pause();
        else {
          if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) player.seekTo(0);
          player.play();
        }
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.hairline,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.beacon, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={status.playing ? 'pause' : 'play'} size={16} color={c.onBeacon} />
      </View>
      <T v="bodyStrong" style={{ flex: 1 }}>Clip {index}</T>
      <T v="small" color={c.muted}>{secs ? `${secs} s, ` : ''}{time}</T>
    </Pressable>
  );
}
