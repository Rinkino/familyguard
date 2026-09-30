import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Avatar, Button, Row, Screen, Section, T, Toggle, TopBar, confirm } from '@/components/ui';
import { firstName, useStore } from '@/state/store';
import { space, useColors } from '@/theme';

export default function CircleDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const circle = store.circles.find((x) => x.id === id);

  if (!circle) {
    return (
      <Screen>
        <TopBar />
        <T v="heading" style={{ marginTop: space.lg }}>This circle was deleted.</T>
      </Screen>
    );
  }

  const connected = store.people.filter((p) => p.status === 'connected');

  return (
    <Screen>
      <TopBar />
      <T v="title" style={{ marginTop: space.md }}>{circle.name}</T>

      <Section note="Turning this on shares with everyone in the circle, even people you haven't shared with one by one.">
        <Row last>
          <T v="bodyStrong" style={{ flex: 1 }}>Share your location with everyone in {circle.name}</T>
          <Toggle
            value={circle.shareWithCircle}
            onChange={(v) => store.dispatch({ type: 'saveCircle', circle: { ...circle, shareWithCircle: v } })}
          />
        </Row>
      </Section>

      <Section title="People">
        {connected.map((p, i) => {
          const inCircle = circle.memberIds.includes(p.id);
          return (
            <Row
              key={p.id}
              last={i === connected.length - 1}
              onPress={() => store.dispatch({ type: 'toggleCircleMember', circleId: circle.id, personId: p.id })}
              accessibilityLabel={`${inCircle ? 'Remove' : 'Add'} ${p.name}`}
            >
              <Avatar name={p.name} tint={p.tint} size={36} />
              <View style={{ flex: 1 }}>
                <T v="bodyStrong">{firstName(p.name)}</T>
                <T v="small" color={c.muted}>{p.label}</T>
              </View>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: inCircle ? c.beacon : 'transparent',
                  borderWidth: 2,
                  borderColor: inCircle ? c.beacon : c.hairline,
                }}
              >
                {inCircle && <Feather name="check" size={16} color={c.onBeacon} />}
              </View>
            </Row>
          );
        })}
      </Section>

      <View style={{ marginTop: space.xl }}>
        <Button
          kind="danger"
          label="Delete circle"
          onPress={() =>
            confirm(`Delete ${circle.name}?`, 'People stay in your list. Only the group is removed.', 'Delete', () => {
              store.dispatch({ type: 'deleteCircle', circleId: circle.id });
              router.back();
            })
          }
        />
      </View>
    </Screen>
  );
}
