import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { listClips, saveClipToPhone, type Clip } from '@/lib/recordings';
import { space, useColors } from '@/theme';
import { T, notice } from './ui';

/** Audio clips recorded during an SOS, oldest first. Refreshes every 15 s while live. */
export function SosClips({ alertId, name, live = false }: { alertId: string; name: string; live?: boolean }) {
  const c = useColors();
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      listClips(alertId)
        .then((c) => !cancelled && setClips(c))
        .catch((e) => !cancelled && setError(e.message));
    load();
    const t = live ? setInterval(load, 15_000) : undefined;
    return () => {
      cancelled = true;
      if (t) clearInterval(t);
    };
  }, [alertId, live]);

  if (error) return <T v="small" color={c.flare}>Couldn't load audio: {error}</T>;
  if (!clips) return <ActivityIndicator color={c.beacon} />;
  if (clips.length === 0) {
    return <T v="small" color={c.muted}>{live ? 'No audio yet. Clips arrive every 30 seconds while recording.' : 'No audio.'}</T>;
  }

  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 18, overflow: 'hidden' }}>
      {clips.map((clip, i) => (
        <ClipRow key={clip.id} clip={clip} index={i + 1} last={i === clips.length - 1} name={`${name} clip ${i + 1}`} />
      ))}
    </View>
  );
}

function ClipRow({ clip, index, last, name }: { clip: Clip; index: number; last: boolean; name: string }) {
  const c = useColors();
  const player = useAudioPlayer(clip.url);
  const status = useAudioPlayerStatus(player);
  const [saving, setSaving] = useState(false);
  const time = new Date(clip.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const secs = clip.durationMs ? Math.round(clip.durationMs / 1000) : null;

  const toggle = () => {
    if (status.playing) return player.pause();
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) player.seekTo(0);
    player.play();
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveClipToPhone(clip, name);
    } catch (e) {
      notice("Couldn't save the clip", e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.hairline,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${status.playing ? 'Pause' : 'Play'} clip ${index}`}
        onPress={toggle}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.beacon, alignItems: 'center', justifyContent: 'center' }}
      >
        <Feather name={status.playing ? 'pause' : 'play'} size={16} color={c.onBeacon} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">Clip {index}</T>
        <T v="small" color={c.muted}>{secs ? `${secs} s, ` : ''}{time}</T>
      </View>
      {Platform.OS !== 'web' && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Save clip ${index} to phone`} onPress={save} disabled={saving} hitSlop={8}>
          {saving ? <ActivityIndicator color={c.beacon} /> : <Feather name="download" size={20} color={c.beacon} />}
        </Pressable>
      )}
    </View>
  );
}
