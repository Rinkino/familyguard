import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { BondLine } from '@/components/BondLine';
import { Avatar, Button, Row, Screen, Section, T } from '@/components/ui';
import { effectiveShare, firstName, useStore } from '@/state/store';
import { space, useColors } from '@/theme';

export default function People() {
  const c = useColors();
  const store = useStore();
  const connected = store.people.filter((p) => p.status === 'connected');
  const pending = store.people.filter((p) => p.status === 'pending');
  const seeMe = connected.filter((p) => effectiveShare(store, p)).length;
  const iSee = connected.filter((p) => p.theyShare).length;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg }}>
        <T v="title">People</T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add person"
          onPress={() => router.push('/add-person')}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.beacon, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="plus" size={22} color={c.onBeacon} />
        </Pressable>
      </View>

      {store.pausedAll ? (
        <Pressable
          onPress={() => store.dispatch({ type: 'setPausedAll', value: false })}
          style={{ marginTop: space.md, padding: space.md, borderRadius: 14, backgroundColor: c.flareSoft }}
        >
          <T v="smallStrong" color={c.flare}>Sharing is paused for everyone. Tap to resume.</T>
        </Pressable>
      ) : (
        <T v="body" color={c.muted} style={{ marginTop: space.xs }}>
          {seeMe} {seeMe === 1 ? 'person' : 'people'} can see you. You can see {iSee}.
        </T>
      )}

      {connected.length === 0 && pending.length === 0 ? (
        <View style={{ marginTop: space.xxl, gap: space.md }}>
          <T v="heading">Add your first person</T>
          <T v="body" color={c.muted}>Send them your code, or enter theirs. Nothing is shared until you choose to.</T>
          <Button label="Add person" onPress={() => router.push('/add-person')} />
        </View>
      ) : null}

      {pending.length > 0 && (
        <Section title="Waiting to accept">
          {pending.map((p, i) => (
            <Row key={p.id} last={i === pending.length - 1} onPress={() => router.push(`/person/${p.id}`)}>
              <View style={{ opacity: 0.5 }}>
                <Avatar name={p.name} tint={p.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyStrong">{p.name}</T>
                <T v="small" color={c.muted}>Request sent. {firstName(p.name)} hasn't accepted yet.</T>
              </View>
            </Row>
          ))}
        </Section>
      )}

      {connected.length > 0 && (
        <Section>
          {connected.map((p, i) => {
            const iShare = effectiveShare(store, p);
            return (
              <Row key={p.id} last={i === connected.length - 1} onPress={() => router.push(`/person/${p.id}`)} accessibilityLabel={`${p.name}, ${p.label}`}>
                <Avatar name={p.name} tint={p.tint} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="bodyStrong" numberOfLines={1}>
                    {firstName(p.name)} <T v="body" color={c.muted}>({p.label})</T>
                  </T>
                  <T v="small" color={p.theyShare ? c.ink : c.muted} numberOfLines={1}>
                    {p.theyShare ? `${p.place}, ${p.lastSeen}` : 'Location not shared with you'}
                  </T>
                </View>
                <View style={{ width: 64, height: 12, flexDirection: 'row' }}>
                  <BondLine iShare={iShare} theyShare={p.theyShare} thickness={2} />
                </View>
              </Row>
            );
          })}
        </Section>
      )}
    </Screen>
  );
}
