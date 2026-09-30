import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '@/state/store';
import { supabase } from './supabase';

const CHUNK_MS = 30_000;
const MAX_MS = 30 * 60_000;

type RecorderState = {
  recording: boolean;
  startedAt: number | null;
  chunksUploaded: number;
  error: string | null;
};

const RecorderContext = createContext<RecorderState>({ recording: false, startedAt: null, chunksUploaded: 0, error: null });

async function upload(alertId: string, userId: string, uri: string, durationMs: number) {
  if (!supabase) return;
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
  const path = `${alertId}/${Date.now()}.${ext}`;
  const body = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage
    .from('sos-recordings')
    .upload(path, body, { contentType: ext === 'm4a' ? 'audio/mp4' : `audio/${ext}` });
  if (error) throw new Error(error.message);
  const { error: rowError } = await supabase
    .from('sos_recordings')
    .insert({ alert_id: alertId, user_id: userId, path, duration_ms: Math.round(durationMs) });
  if (rowError) throw new Error(rowError.message);
}

/**
 * Records audio while you have an active SOS, in 30-second chunks so each
 * piece reaches your watchers as soon as it's done, until you're marked safe
 * or 30 minutes pass. Foreground only in Expo Go.
 */
export function SosRecorderProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<RecorderState>({ recording: false, startedAt: null, chunksUploaded: 0, error: null });
  const sosId = store.alerts.find((a) => a.forId === 'me' && a.stage === 'sos')?.id ?? null;
  const running = useRef<string | null>(null);

  useEffect(() => {
    if (!sosId || running.current === sosId || !store.me.id) return;
    running.current = sosId;
    const userId = store.me.id;
    let stop = false;

    (async () => {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setState((s) => ({ ...s, error: 'Microphone access is off, so no audio is being recorded.' }));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      const startedAt = Date.now();
      setState({ recording: true, startedAt, chunksUploaded: 0, error: null });

      while (!stop && Date.now() - startedAt < MAX_MS) {
        await recorder.prepareToRecordAsync();
        recorder.record();
        const chunkStart = Date.now();
        while (!stop && Date.now() - chunkStart < CHUNK_MS) {
          await new Promise((r) => setTimeout(r, 500));
          stop = stop || running.current !== sosId;
        }
        await recorder.stop();
        const uri = recorder.uri;
        if (uri) {
          upload(sosId, userId, uri, Date.now() - chunkStart)
            .then(() => setState((s) => ({ ...s, chunksUploaded: s.chunksUploaded + 1 })))
            .catch((e) => setState((s) => ({ ...s, error: `Upload failed: ${e.message}. Recording continues.` })));
        }
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setState((s) => ({ ...s, recording: false }));
    })().catch((e) => setState((s) => ({ ...s, recording: false, error: `Recording stopped: ${e.message}` })));

    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sosId, store.me.id]);

  // SOS ended: the loop above sees this and uploads its last chunk.
  useEffect(() => {
    if (!sosId) running.current = null;
  }, [sosId]);

  return <RecorderContext.Provider value={state}>{children}</RecorderContext.Provider>;
}

export function useSosRecorder() {
  return useContext(RecorderContext);
}
