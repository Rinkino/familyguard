import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Button, Screen, T, TopBar, confirm } from '@/components/ui';
import { firstName, useStore } from '@/state/store';
import { space, useColors } from '@/theme';

/** What a guardian agreement means, written for whichever side is reading. */
function Terms({ guardian, dependent, you }: { guardian: string; dependent: string; you: 'guardian' | 'dependent' | 'none' }) {
  const c = useColors();
  const g = you === 'guardian' ? 'You' : guardian;
  const d = you === 'dependent' ? 'you' : dependent;
  const dPossessive = you === 'dependent' ? 'your' : `${dependent}'s`;
  const lines = [
    `${g} always ${you === 'guardian' ? 'see' : 'sees'} where ${d} ${you === 'dependent' ? 'are' : 'is'}. ${you === 'dependent' ? 'You' : dependent} can't turn this off or pause it.`,
    `Only ${g === 'You' ? 'you' : guardian} (and any other guardians) can set zones and time limits for ${d}.`,
    `${g} ${you === 'guardian' ? 'get' : 'gets'} every alert and SOS from ${d}, and can delete ${dPossessive} SOS recordings.`,
    `${g} ${you === 'guardian' ? 'choose' : 'chooses'} whether ${d} can see ${you === 'guardian' ? 'your' : `${guardian}'s`} location.`,
    `${g} can end this at any time. ${you === 'dependent' ? 'You' : dependent} can ask to be released.`,
  ];
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 18, padding: space.md, gap: space.md, marginTop: space.lg }}>
      {lines.map((line) => (
        <View key={line} style={{ flexDirection: 'row', gap: space.sm }}>
          <Feather name="check" size={16} color={c.beaconText} style={{ marginTop: 3 }} />
          <T v="body" style={{ flex: 1 }}>{line}</T>
        </View>
      ))}
    </View>
  );
}

export default function GuardianAgreement() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const person = store.people.find((p) => p.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!person || person.status !== 'connected') {
    return (
      <Screen>
        <TopBar close />
        <T v="heading" style={{ marginTop: space.lg }}>You need to be connected before making an agreement.</T>
      </Screen>
    );
  }

  const name = firstName(person.name);
  const me = firstName(store.me.name) || 'You';
  const g = person.guardianship;

  const act = (fn: () => Promise<unknown>, closeAfter = true) => async () => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (closeAfter) router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;

  if (!g) {
    body = (
      <>
        <T v="title" style={{ marginTop: space.md }}>Parent and child agreement</T>
        <T v="body" color={c.muted} style={{ marginTop: space.sm }}>
          For a parent and child, or anyone who agrees one person looks after the other. Both of you must accept.
        </T>
        <T v="heading" style={{ marginTop: space.xl }}>If you become {name}'s guardian</T>
        <Terms guardian={me} dependent={name} you="guardian" />
        <View style={{ marginTop: space.xl, gap: space.sm }}>
          <Button
            label={`Ask to be ${name}'s guardian`}
            disabled={busy}
            onPress={act(() => store.actions.proposeGuardianship(person.id, true))}
          />
          <Button
            kind="secondary"
            label={`Ask ${name} to be my guardian`}
            disabled={busy}
            onPress={act(() => store.actions.proposeGuardianship(person.id, false))}
          />
        </View>
      </>
    );
  } else if (g.status === 'proposed' && g.proposedByMe) {
    body = (
      <>
        <T v="title" style={{ marginTop: space.md }}>Waiting for {name}</T>
        <T v="body" color={c.muted} style={{ marginTop: space.sm }}>
          {g.iAmGuardian ? `You asked to be ${name}'s guardian.` : `You asked ${name} to be your guardian.`} Nothing changes until{' '}
          {name} accepts.
        </T>
        <Terms guardian={g.iAmGuardian ? me : name} dependent={g.iAmGuardian ? name : me} you={g.iAmGuardian ? 'guardian' : 'dependent'} />
        <View style={{ marginTop: space.xl }}>
          <Button kind="danger" label="Cancel request" disabled={busy} onPress={act(() => store.actions.respondGuardianship(person, false))} />
        </View>
      </>
    );
  } else if (g.status === 'proposed') {
    body = (
      <>
        <T v="title" style={{ marginTop: space.md }}>
          {g.iAmGuardian ? `${name} asked you to be their guardian` : `${name} wants to be your guardian`}
        </T>
        <T v="body" color={c.muted} style={{ marginTop: space.sm }}>Read what this means before you accept.</T>
        <Terms guardian={g.iAmGuardian ? me : name} dependent={g.iAmGuardian ? name : me} you={g.iAmGuardian ? 'guardian' : 'dependent'} />
        <View style={{ marginTop: space.xl, gap: space.sm }}>
          <Button label="Accept agreement" disabled={busy} onPress={act(() => store.actions.respondGuardianship(person, true))} />
          <Button kind="secondary" label="Decline" disabled={busy} onPress={act(() => store.actions.respondGuardianship(person, false))} />
        </View>
      </>
    );
  } else if (g.iAmGuardian) {
    const asked = g.status === 'release_requested';
    body = (
      <>
        <T v="title" style={{ marginTop: space.md }}>{asked ? `${name} asked to be released` : `You're ${name}'s guardian`}</T>
        {asked && (
          <T v="body" color={c.muted} style={{ marginTop: space.sm }}>
            Until you decide, the agreement stays in place.
          </T>
        )}
        <Terms guardian={me} dependent={name} you="guardian" />
        <View style={{ marginTop: space.xl, gap: space.sm }}>
          {asked ? (
            <>
              <Button label={`Release ${name}`} disabled={busy} onPress={act(() => store.actions.endGuardianship(person.id, true))} />
              <Button kind="secondary" label="Keep the agreement" disabled={busy} onPress={act(() => store.actions.endGuardianship(person.id, false))} />
            </>
          ) : (
            <Button
              kind="danger"
              label="End agreement"
              disabled={busy}
              onPress={() =>
                confirm(
                  'End agreement?',
                  `${name} goes back to choosing what to share, and your zones for ${name} stay until you turn them off.`,
                  'End',
                  act(() => store.actions.endGuardianship(person.id, true))
                )
              }
            />
          )}
        </View>
      </>
    );
  } else {
    const asked = g.status === 'release_requested';
    body = (
      <>
        <T v="title" style={{ marginTop: space.md }}>{name} is your guardian</T>
        <Terms guardian={name} dependent={me} you="dependent" />
        <View style={{ marginTop: space.xl, gap: space.sm }}>
          {asked ? (
            <T v="body" color={c.muted}>You asked to be released. Waiting for {name} to decide.</T>
          ) : (
            <Button kind="secondary" label="Ask to be released" disabled={busy} onPress={act(() => store.actions.requestRelease(person.id), false)} />
          )}
        </View>
      </>
    );
  }

  return (
    <Screen>
      <TopBar close title="Agreement" />
      <View style={{ alignItems: 'center', marginTop: space.md }}>
        <Avatar name={person.name} tint={person.tint} size={64} />
      </View>
      {body}
      {error ? <T v="small" color={c.flare} style={{ marginTop: space.md }}>{error}</T> : null}
    </Screen>
  );
}
