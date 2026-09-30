import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SosClips } from '@/components/SosClips';
import { Button, Field, Screen, T, TopBar, confirm } from '@/components/ui';
import { defaultTitle, listRecordingGroups, type RecordingGroup } from '@/lib/recordings';
import { iGuard, myGuardians, useStore, whoName } from '@/state/store';
import { space, useColors } from '@/theme';

/** One SOS in the library: rename it, play or save clips, delete it. */
export default function RecordingDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const [group, setGroup] = useState<RecordingGroup | null | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listRecordingGroups()
      .then((all) => {
        const g = all.find((x) => x.alertId === id) ?? null;
        setGroup(g);
        if (g) setTitle(g.title ?? defaultTitle(g));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (group === undefined) {
    return (
      <Screen>
        <TopBar />
        {error ? <T v="body" color={c.flare}>{error}</T> : <ActivityIndicator color={c.beacon} style={{ marginTop: space.xl }} />}
      </Screen>
    );
  }
  if (!group) {
    return (
      <Screen>
        <TopBar />
        <T v="heading" style={{ marginTop: space.lg }}>This recording was deleted.</T>
      </Screen>
    );
  }

  const isMine = group.forUser === store.me.id;
  const person = store.people.find((p) => p.id === group.forUser);
  const name = isMine ? 'You' : whoName(store.people, group.forUser);
  // Mirrors the server rule: you manage your own audio unless you have a guardian; guardians manage their dependents'.
  const canManage = (isMine && myGuardians(store.people).length === 0) || iGuard(person);
  const canRename = canManage || isMine;
  const shownTitle = group.title ?? defaultTitle(group);
  const changed = title.trim() !== shownTitle;

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Recording" />
      <T v="title" style={{ marginTop: space.md }}>{shownTitle}</T>
      <T v="body" color={c.muted} style={{ marginTop: space.xs }}>
        {isMine ? 'Your SOS' : `${name}'s SOS`}.{' '}
        {new Date(group.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
      </T>

      {canRename && (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <Field label="Name" value={title} onChangeText={setTitle} placeholder={defaultTitle(group)} maxLength={80} />
          {changed && (
            <Button
              kind="secondary"
              label={busy ? 'Saving…' : 'Save name'}
              disabled={busy || !title.trim()}
              onPress={() =>
                run(
                  () => store.actions.renameAlert(group.alertId, title),
                  () => setGroup({ ...group, title: title.trim() })
                )
              }
            />
          )}
        </View>
      )}

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <T v="heading">Clips</T>
        <T v="small" color={c.muted}>Tap the download icon to save a clip to your phone or send it.</T>
        <SosClips alertId={group.alertId} name={shownTitle} />
      </View>

      {error ? <T v="small" color={c.flare} style={{ marginTop: space.md }}>{error}</T> : null}

      <View style={{ marginTop: space.xl }}>
        {canManage ? (
          <Button
            kind="danger"
            label="Delete recording"
            disabled={busy}
            onPress={() =>
              confirm(
                'Delete this recording?',
                `All ${group.clipCount} clips are removed for everyone, including watchers. This can't be undone. Save clips to your phone first if you might need them.`,
                'Delete',
                () => run(() => store.actions.deleteRecordings(group.alertId), () => router.back())
              )
            }
          />
        ) : (
          <T v="small" color={c.muted} style={{ textAlign: 'center' }}>
            {isMine ? 'Only your guardian can delete your recordings.' : `Only ${name} or their guardian can delete this.`}
          </T>
        )}
      </View>
    </Screen>
  );
}
