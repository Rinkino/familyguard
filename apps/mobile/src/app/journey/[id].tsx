import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { FamilyMap } from '@/components/map/FamilyMap';
import { Avatar, Button, Field, Screen, Section, Row, T, TopBar, attempt, confirm } from '@/components/ui';
import { distanceMeters, formatDistance, formatDuration } from '@/lib/geo';
import { getRoute } from '@/lib/mapbox';
import { formatAgo, useNow, useStore, whoName } from '@/state/store';
import { space, useColors } from '@/theme';

/** A journey in progress: for the traveller (report, reroute, end) and for watchers. */
export default function JourneyDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const now = useNow();
  const journey = store.journeys.find((j) => j.id === id);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'report' | 'reroute' | null>(null);

  if (!journey) {
    return (
      <Screen>
        <TopBar />
        <T v="heading" style={{ marginTop: space.lg }}>This journey has ended.</T>
      </Screen>
    );
  }

  const mine = journey.forId === 'me';
  const traveller = store.people.find((p) => p.id === journey.forId);
  const name = whoName(store.people, journey.forId);
  const position = mine ? store.myCoord : traveller?.coord;
  const left = position ? distanceMeters(position, journey.destination) : null;
  const elapsed = (now - journey.startedAt) / 1000;
  const expectedAt = journey.startedAt + journey.routeDurationS * 1000;
  const late = now > expectedAt + 10 * 60_000;
  const roadblocks = store.roadblocks.filter((r) => r.journeyId === journey.id);
  const openAlert = store.alerts.find((a) => a.journeyId === journey.id && a.stage !== 'resolved');

  const report = () =>
    attempt(
      (async () => {
        setBusy('report');
        await store.actions.reportRoadblock(journey.id, store.myCoord, note);
        setNote('');
        setReporting(false);
      })().finally(() => setBusy(null))
    );

  const reroute = () =>
    attempt(
      (async () => {
        setBusy('reroute');
        const r = await getRoute(store.myCoord, journey.destination, journey.mode);
        await store.actions.rerouteJourney(journey.id, r.coords, r.distanceM, r.durationS);
      })().finally(() => setBusy(null))
    );

  return (
    <Screen>
      <TopBar title={mine ? 'Your journey' : `${name}'s journey`} />

      <View style={{ height: 280, borderRadius: 20, overflow: 'hidden', marginTop: space.sm }}>
        <FamilyMap
          initialCenter={position ?? journey.destination}
          initialSpanM={Math.max(2000, journey.routeDistanceM * 0.9)}
          route={journey.route}
          markers={[
            { id: 'dest', coord: journey.destination, kind: 'destination', title: journey.destinationName },
            ...roadblocks.map((r) => ({ id: r.id, coord: r.coord, kind: 'roadblock' as const, title: r.note ?? 'Roadblock' })),
          ]}
          people={
            position
              ? [{
                  id: journey.forId,
                  name: mine ? store.me.name || 'You' : traveller?.name ?? name,
                  tint: mine ? store.me.tint : traveller?.tint ?? 0,
                  coord: position,
                  alert: Boolean(openAlert),
                }]
              : []
          }
        />
      </View>

      <T v="title" style={{ marginTop: space.lg }}>To {journey.destinationName}</T>
      <T v="body" color={c.muted} style={{ marginTop: space.xs }}>
        Started {formatAgo(journey.startedAt)}. Planned {formatDuration(journey.routeDurationS)} for{' '}
        {formatDistance(journey.routeDistanceM)}.
      </T>

      <Section>
        <Row>
          <Feather name="flag" size={18} color={c.beaconText} />
          <T v="body" style={{ flex: 1 }}>
            {left != null ? `${formatDistance(left)} from the destination in a straight line` : 'Waiting for a location'}
          </T>
        </Row>
        <Row last>
          <Feather name="clock" size={18} color={late ? c.flare : c.beaconText} />
          <T v="body" color={late ? c.flare : c.ink} style={{ flex: 1 }}>
            {late
              ? `Running late: expected ${new Date(expectedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
              : `Expected around ${new Date(expectedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (${formatDuration(Math.max(60, journey.routeDurationS - elapsed))} left)`}
          </T>
        </Row>
      </Section>

      {openAlert && (
        <Button
          kind="danger"
          label={mine ? "You're off route. Open alert" : `${name} is off route. Open alert`}
          onPress={() => router.push(mine ? '/check-in' : `/alert/${openAlert.id}`)}
          style={{ marginTop: space.md }}
        />
      )}

      <Section title="Roadblocks" note={mine ? 'Watchers see these marked as reported by you.' : `Reported by ${name}, not checked by anyone else.`}>
        {roadblocks.length === 0 ? (
          <Row last>
            <T v="small" color={c.muted}>None reported.</T>
          </Row>
        ) : (
          roadblocks.map((r, i) => (
            <Row key={r.id} last={i === roadblocks.length - 1}>
              <Feather name="alert-octagon" size={18} color={c.flare} />
              <View style={{ flex: 1 }}>
                <T v="body">{r.note ?? 'Road blocked'}</T>
                <T v="small" color={c.muted}>Reported by {mine ? 'you' : name}, {formatAgo(r.createdAt)}</T>
              </View>
            </Row>
          ))
        )}
      </Section>

      {mine && (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {reporting ? (
            <>
              <Field label="What's blocked? (optional)" value={note} onChangeText={setNote} placeholder="Road closed at Ojota" maxLength={200} />
              <Button label={busy === 'report' ? 'Reporting…' : 'Report at my location'} disabled={busy !== null} onPress={report} />
              <Button kind="plain" label="Cancel" onPress={() => setReporting(false)} />
            </>
          ) : (
            <>
              <Button kind="secondary" label="Report a roadblock" onPress={() => setReporting(true)} />
              <Button
                kind="secondary"
                label={busy === 'reroute' ? 'Finding a new route…' : 'Reroute from here'}
                disabled={busy !== null}
                onPress={reroute}
              />
              <Button label="I've arrived" onPress={() => attempt(store.actions.endJourney(journey.id, true), () => router.back())} />
              <Button
                kind="danger"
                label="Cancel journey"
                onPress={() =>
                  confirm('Cancel this journey?', 'Your watchers stop following your route.', 'Cancel journey', () =>
                    attempt(store.actions.endJourney(journey.id, false), () => router.back())
                  )
                }
              />
            </>
          )}
        </View>
      )}

      {!mine && traveller && (
        <View style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={traveller.name} tint={traveller.tint} size={36} />
          <T v="small" color={c.muted} style={{ flex: 1 }}>
            You'll be alerted if {name} goes more than {formatDistance(journey.maxDeviationM)} off this route.
          </T>
        </View>
      )}
    </Screen>
  );
}
