import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { FamilyMap } from '@/components/map/FamilyMap';
import { Button, Screen, T, TopBar, notice } from '@/components/ui';
import { distanceMeters, formatDistance } from '@/lib/geo';
import type { AlertStage } from '@/mock/data';
import { formatRemaining, useNow, useStore, whoName } from '@/state/store';
import { space, useColors } from '@/theme';

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** What a watcher sees when someone leaves a zone. */
export default function AlertDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const now = useNow();
  const alert = store.alerts.find((a) => a.id === id);
  const zone = store.zones.find((z) => z.id === alert?.zoneId);
  const person = store.people.find((p) => p.id === alert?.forId);

  if (!alert || !zone || !person?.coord) {
    return (
      <Screen>
        <TopBar close />
        <T v="heading" style={{ marginTop: space.lg }}>This alert has ended.</T>
      </Screen>
    );
  }

  const name = whoName(store.people, alert.forId);
  const outside = Math.max(0, distanceMeters(person.coord, zone.center) - zone.radiusM);
  const left = alert.stageEndsAt ? formatRemaining(alert.stageEndsAt - now) : '';
  const watchers = ['You', ...zone.watcherIds.map((w) => whoName(store.people, w))].join(', ');

  const headline: Record<AlertStage, string> = {
    left: `${name} left ${zone.name}`,
    checking: `Waiting for ${name} to answer`,
    sos: `SOS from ${name}`,
    resolved:
      alert.resolvedHow === 'back-inside' ? `${name} is back inside ${zone.name}`
      : alert.resolvedHow === 'said-ok' ? `${name} answered: I'm OK`
      : `You marked ${name} safe`,
  };
  const body: Record<AlertStage, string> = {
    left: `${formatDistance(outside)} outside the zone. If ${name} isn't back in ${left}, we'll ask “Are you OK?” on ${name}'s phone.`,
    checking: `${name} has ${left} to answer before an SOS goes out to everyone watching.`,
    sos: `${name} didn't answer. Audio recording started on ${name}'s phone. Call ${name}, or get help if you can't reach them.`,
    resolved: 'No further alerts for this.',
  };

  const steps: { label: string; at?: number; done: boolean; now: boolean }[] = [
    { label: `Left ${zone.name}. ${watchers} alerted.`, at: alert.leftAt, done: true, now: alert.stage === 'left' },
    { label: `Asked “Are you OK?”`, done: ['checking', 'sos'].includes(alert.stage), now: alert.stage === 'checking' },
    { label: 'SOS sent, recording audio', at: alert.sosAt, done: alert.stage === 'sos', now: alert.stage === 'sos' },
  ];

  const urgent = alert.stage === 'sos' || alert.stage === 'checking';

  return (
    <Screen>
      <TopBar close title="Zone alert" />

      <View style={{ height: 240, borderRadius: 20, overflow: 'hidden', marginTop: space.sm }}>
        <FamilyMap
          initialCenter={zone.center}
          initialSpanM={(zone.radiusM + outside) * 3}
          zones={[{ ...zone, alert: alert.stage !== 'resolved' }]}
          people={[{ id: person.id, name: person.name, tint: person.tint, coord: person.coord, alert: alert.stage !== 'resolved' }]}
        />
      </View>

      <T v="title" color={urgent ? c.flare : c.ink} style={{ marginTop: space.lg }}>{headline[alert.stage]}</T>
      <T v="body" color={c.muted} style={{ marginTop: space.sm }}>{body[alert.stage]}</T>

      {alert.stage !== 'resolved' && (
        <View style={{ marginTop: space.lg, gap: space.md }}>
          {steps.map((s) => (
            <View key={s.label} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: s.done ? (s.now && urgent ? c.flare : c.beacon) : 'transparent',
                  borderWidth: 2,
                  borderColor: s.done ? (s.now && urgent ? c.flare : c.beacon) : c.hairline,
                }}
              >
                {s.done && <Feather name="check" size={13} color="#FFFFFF" />}
              </View>
              <T v={s.now ? 'bodyStrong' : 'body'} color={s.done ? c.ink : c.muted} style={{ flex: 1 }}>
                {s.label}
              </T>
              {s.at ? <T v="small" color={c.muted}>{time(s.at)}</T> : null}
            </View>
          ))}
        </View>
      )}

      <View style={{ marginTop: space.xl, gap: space.sm }}>
        {alert.stage === 'resolved' ? (
          <Button
            label="Done"
            onPress={() => {
              store.dispatch({ type: 'dismissAlert', alertId: alert.id });
              router.back();
            }}
          />
        ) : (
          <>
            <Button
              kind={urgent ? 'primary' : 'secondary'}
              label={`Call ${name}`}
              icon={<Feather name="phone" size={16} color={urgent ? c.onBeacon : c.ink} />}
              onPress={() => notice('Calling is not set up yet', 'In the real app this dials their phone number.')}
            />
            {alert.stage === 'sos' && (
              <Button kind="secondary" label={`Mark ${name} safe`} onPress={() => store.dispatch({ type: 'markSafe', alertId: alert.id })} />
            )}
            <T v="smallStrong" color={c.muted} style={{ marginTop: space.lg }}>Demo</T>
            <Button kind="secondary" label={`${name} comes back inside`} onPress={() => store.dispatch({ type: 'backInside', alertId: alert.id })} />
            {alert.stage === 'checking' && (
              <Button kind="secondary" label={`${name} answers I'm OK`} onPress={() => store.dispatch({ type: 'sayOk', alertId: alert.id })} />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
