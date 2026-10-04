import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { FamilyMap } from '@/components/map/FamilyMap';
import { SosClips } from '@/components/SosClips';
import { Button, Screen, T, TopBar, attempt, notice } from '@/components/ui';
import { distanceMeters, formatDistance } from '@/lib/geo';
import { formatRemaining, useNow, useStore, whoName } from '@/state/store';
import type { AlertStage } from '@/types';
import { space, useColors } from '@/theme';

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** What a watcher sees when someone leaves a zone or sends an SOS. */
export default function AlertDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const now = useNow();
  const alert = store.alerts.find((a) => a.id === id);

  if (!alert) {
    return (
      <Screen>
        <TopBar close />
        <T v="heading" style={{ marginTop: space.lg }}>This alert has ended.</T>
      </Screen>
    );
  }

  const person = store.people.find((p) => p.id === alert.forId);
  const zone = store.zones.find((z) => z.id === alert.zoneId);
  const name = whoName(store.people, alert.forId);
  const coord = person?.coord ?? alert.coord;
  const zoneName = alert.zoneName ?? 'the zone';
  const outside = zone && coord ? Math.max(0, distanceMeters(coord, zone.center) - zone.radiusM) : null;
  const left = alert.stageEndsAt ? formatRemaining(alert.stageEndsAt - now) : '';
  const manual = alert.kind === 'manual';
  const silence = alert.kind === 'silence';
  const open = alert.stage !== 'resolved';
  const urgent = alert.stage === 'sos' || alert.stage === 'checking';

  const headline: Record<AlertStage, string> = {
    left: silence ? `${name}'s phone stopped reporting` : `${name} left ${zoneName}`,
    checking: `Waiting for ${name} to answer`,
    sos: `SOS from ${name}`,
    resolved:
      alert.resolvedHow === 'back-inside' ? `${name} is back inside ${zoneName}`
      : alert.resolvedHow === 'said-ok' ? `${name} answered: I'm OK`
      : alert.resolvedHow === 'back-online' ? `${name}'s phone is reporting again`
      : `${name} was marked safe`,
  };
  const body: Record<AlertStage, string> = {
    left: silence
      ? `No location since ${time(alert.leftAt)}. The phone may be switched off, out of signal, or the app closed. The pin shows where ${name} was last seen. Try calling.`
      : `${outside != null ? `${formatDistance(outside)} outside the zone. ` : ''}If ${name} isn't back in ${left}, we'll ask “Are you OK?” on ${name}'s phone.`,
    checking: `${name} has ${left} to answer before an SOS goes out to everyone watching.`,
    sos: manual
      ? `${name} pressed SOS. Audio is recording on ${name}'s phone. Call ${name}, or get help if you can't reach them.`
      : `${name} didn't answer. Audio is recording on ${name}'s phone. Call ${name}, or get help if you can't reach them.`,
    resolved: 'No further alerts for this.',
  };

  const steps = manual
    ? [{ label: 'SOS sent, recording audio', at: alert.sosAt, done: true, now: alert.stage === 'sos' }]
    : [
        { label: `Left ${zoneName}. Watchers alerted.`, at: alert.leftAt, done: true, now: alert.stage === 'left' },
        { label: 'Asked “Are you OK?”', done: ['checking', 'sos'].includes(alert.stage), now: alert.stage === 'checking' },
        { label: 'SOS sent, recording audio', at: alert.sosAt, done: alert.stage === 'sos', now: alert.stage === 'sos' },
      ];

  return (
    <Screen>
      <TopBar close title={manual ? 'SOS' : silence ? 'Not reporting' : 'Zone alert'} />

      {coord && (
        <View style={{ height: 240, borderRadius: 20, overflow: 'hidden', marginTop: space.sm }}>
          <FamilyMap
            initialCenter={coord}
            initialSpanM={zone ? (zone.radiusM + (outside ?? 0)) * 3 : 1500}
            zones={zone ? [{ ...zone, alert: open }] : []}
            people={[{ id: alert.forId, name: person?.name ?? name, tint: person?.tint ?? 0, coord, alert: open }]}
          />
        </View>
      )}

      <T v="title" color={urgent ? c.flare : c.ink} style={{ marginTop: space.lg }}>{headline[alert.stage]}</T>
      <T v="body" color={c.muted} style={{ marginTop: space.sm }}>{body[alert.stage]}</T>

      {open && !silence && (
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

      {alert.sosAt && (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <T v="heading">Audio from {name}'s phone</T>
          <SosClips alertId={alert.id} name={alert.title ?? `${name} SOS`} live={open} />
        </View>
      )}

      <View style={{ marginTop: space.xl, gap: space.sm }}>
        {open ? (
          <>
            <Button
              kind={urgent ? 'primary' : 'secondary'}
              label={`Call ${name}`}
              icon={<Feather name="phone" size={16} color={urgent ? c.onBeacon : c.ink} />}
              onPress={() => notice('Calling is not set up yet', "Phone numbers aren't collected yet. Call them from your contacts.")}
            />
            {alert.stage === 'sos' && (
              <Button kind="secondary" label={`Mark ${name} safe`} onPress={() => attempt(store.actions.markSafe(alert.id))} />
            )}
          </>
        ) : (
          <Button label="Done" onPress={() => router.back()} />
        )}
      </View>
    </Screen>
  );
}
