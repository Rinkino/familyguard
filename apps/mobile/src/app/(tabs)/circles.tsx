import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Avatar, Button, Row, Screen, Section, T } from '@/components/ui';
import { useStore } from '@/state/store';
import { space, useColors } from '@/theme';

export default function Circles() {
  const c = useColors();
  const store = useStore();

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg }}>
        <T v="title">Circles</T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New circle"
          onPress={() => router.push('/circle-new')}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.beacon, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="plus" size={22} color={c.onBeacon} />
        </Pressable>
      </View>
      <T v="body" color={c.muted} style={{ marginTop: space.xs }}>
        Group people so you can share with all of them at once. Only you see your circles.
      </T>

      {store.circles.length === 0 ? (
        <View style={{ marginTop: space.xxl, gap: space.md }}>
          <T v="heading">No circles yet</T>
          <T v="body" color={c.muted}>Make one for home, work or school.</T>
          <Button label="New circle" onPress={() => router.push('/circle-new')} />
        </View>
      ) : (
        <Section>
          {store.circles.map((circle, i) => {
            const members = store.people.filter((p) => circle.memberIds.includes(p.id));
            return (
              <Row key={circle.id} last={i === store.circles.length - 1} onPress={() => router.push(`/circle/${circle.id}`)}>
                <View style={{ flex: 1, gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
                    <T v="bodyStrong">{circle.name}</T>
                    <T v="small" color={c.muted}>
                      {members.length} {members.length === 1 ? 'person' : 'people'}
                    </T>
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    {members.slice(0, 5).map((m, idx) => (
                      <View key={m.id} style={{ marginLeft: idx === 0 ? 0 : -10, borderRadius: 18, borderWidth: 2, borderColor: c.surface }}>
                        <Avatar name={m.name} tint={m.tint} size={32} />
                      </View>
                    ))}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Feather name={circle.shareWithCircle ? 'eye' : 'eye-off'} size={18} color={circle.shareWithCircle ? c.beaconText : c.moss} />
                  <T v="tiny" color={circle.shareWithCircle ? c.beaconText : c.muted}>
                    {circle.shareWithCircle ? 'Sharing' : 'Not sharing'}
                  </T>
                </View>
              </Row>
            );
          })}
        </Section>
      )}
    </Screen>
  );
}
