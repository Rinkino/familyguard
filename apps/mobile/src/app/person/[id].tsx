import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { BondLine } from '@/components/BondLine';
import { Avatar, Button, Icon, Row, Screen, Section, T, Toggle, TopBar, confirm } from '@/components/ui';
import { effectiveShare, firstName, sharingCircles, useStore } from '@/state/store';
import { space, useColors } from '@/theme';

export default function PersonDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const person = store.people.find((p) => p.id === id);

  if (!person) {
    return (
      <Screen>
        <TopBar />
        <T v="heading" style={{ marginTop: space.lg }}>This person is no longer in your list.</T>
      </Screen>
    );
  }

  const name = firstName(person.name);
  const viaCircles = sharingCircles(store.circles, person.id);
  const iShareNow = effectiveShare(store, person);
  const pending = person.status === 'pending';

  const remove = (verb: 'Remove' | 'Block') =>
    confirm(
      `${verb} ${name}?`,
      verb === 'Remove'
        ? `${name} will stop seeing your location and you'll stop seeing theirs. You can add each other again later.`
        : `${name} won't be able to see you or send you requests.`,
      verb,
      () => {
        store.dispatch({ type: 'removePerson', personId: person.id });
        router.back();
      }
    );

  return (
    <Screen>
      <TopBar />

      <View style={{ alignItems: 'center', marginTop: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, width: '100%' }}>
          <Avatar name={store.me.name} tint={store.me.tint} size={64} />
          <BondLine iShare={iShareNow} theyShare={person.theyShare} thickness={4} dots={false} />
          <Avatar name={person.name} tint={person.tint} size={64} />
        </View>
        <T v="title" style={{ marginTop: space.lg, textAlign: 'center' }}>{person.name}</T>
        <T v="body" color={c.muted}>You call them {person.label}</T>
      </View>

      {pending ? (
        <Section note={`Once ${name} accepts, you'll each choose what to share.`}>
          <Row last>
            <Icon name="clock" />
            <T v="body" style={{ flex: 1 }}>Waiting for {name} to accept your request.</T>
          </Row>
        </Section>
      ) : (
        <Section title="Location">
          <Row>
            <View style={{ flex: 1 }}>
              <T v="bodyStrong">Share your location with {name}</T>
              {store.pausedAll ? (
                <T v="small" color={c.flare}>Paused for everyone from the You tab.</T>
              ) : !person.iShare && viaCircles.length > 0 ? (
                <T v="small" color={c.muted}>
                  {name} still sees you through {viaCircles.map((cl) => cl.name).join(' and ')}.
                </T>
              ) : null}
            </View>
            <Toggle value={person.iShare} onChange={(v) => store.dispatch({ type: 'setShare', personId: person.id, value: v })} />
          </Row>
          <Row last>
            <View style={{ flex: 1 }}>
              <T v="bodyStrong">{name} shares with you</T>
              <T v="small" color={c.muted}>
                {person.theyShare ? `${person.place}, ${person.lastSeen}` : `Not right now. Only ${name} can change this.`}
              </T>
            </View>
            <Icon name={person.theyShare ? 'eye' : 'eye-off'} color={person.theyShare ? c.beacon : c.moss} />
          </Row>
        </Section>
      )}

      <Section title="Your label" note={`Only you see this. ${name} picks their own label for you.`}>
        <Row last onPress={() => router.push(`/label/${person.id}`)}>
          <T v="body" style={{ flex: 1 }}>{person.label}</T>
          <T v="smallStrong" color={c.beacon}>Change</T>
        </Row>
      </Section>

      {!pending && store.circles.length > 0 && (
        <Section title="Circles">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.md }}>
            {store.circles.map((circle) => {
              const inCircle = circle.memberIds.includes(person.id);
              return (
                <Pressable
                  key={circle.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: inCircle }}
                  onPress={() => store.dispatch({ type: 'toggleCircleMember', circleId: circle.id, personId: person.id })}
                  style={{
                    paddingHorizontal: space.md,
                    height: 36,
                    borderRadius: 18,
                    justifyContent: 'center',
                    backgroundColor: inCircle ? c.beacon : c.bg,
                  }}
                >
                  <T v="smallStrong" color={inCircle ? c.onBeacon : c.ink}>{circle.name}</T>
                </Pressable>
              );
            })}
          </View>
        </Section>
      )}

      <View style={{ marginTop: space.xl }}>
        <Button kind="danger" label={pending ? 'Cancel request' : `Remove ${name}`} onPress={() => remove('Remove')} />
        {!pending && <Button kind="danger" label={`Block ${name}`} onPress={() => remove('Block')} />}
      </View>
    </Screen>
  );
}
