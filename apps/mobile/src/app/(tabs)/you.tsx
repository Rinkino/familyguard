import { router } from 'expo-router';
import { View } from 'react-native';
import { Avatar, Button, Icon, Row, Screen, Section, T, Toggle, confirm } from '@/components/ui';
import { useStore } from '@/state/store';
import { space, useColors } from '@/theme';

export default function You() {
  const c = useColors();
  const store = useStore();
  const custom = store.templates.filter((t) => !t.builtIn).length;

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: space.xl, gap: space.sm }}>
        <Avatar name={store.me.name} tint={store.me.tint} size={88} />
        <T v="title">{store.me.name}</T>
        <T v="body" color={c.muted}>{store.me.email}</T>
      </View>

      <Section note="While paused, nobody can see your location. Your settings are kept for when you resume.">
        <Row last>
          <Icon name="pause-circle" color={store.pausedAll ? c.flare : c.muted} />
          <T v="bodyStrong" style={{ flex: 1 }}>Pause sharing with everyone</T>
          <Toggle value={store.pausedAll} onChange={(v) => store.dispatch({ type: 'setPausedAll', value: v })} />
        </Row>
      </Section>

      <Section title="Labels">
        <Row last onPress={() => router.push('/templates')}>
          <Icon name="tag" />
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">Your labels</T>
            <T v="small" color={c.muted}>{custom} of your own, plus built-in ones</T>
          </View>
          <Icon name="chevron-right" />
        </Row>
      </Section>

      <Section title="Demo">
        <Row last onPress={() => store.dispatch({ type: 'reset' })}>
          <Icon name="rotate-ccw" />
          <T v="body" style={{ flex: 1 }}>Reset sample people and circles</T>
        </Row>
      </Section>

      <View style={{ marginTop: space.xl }}>
        <Button
          kind="secondary"
          label="Sign out"
          onPress={() => confirm('Sign out?', 'You can sign back in any time.', 'Sign out', () => store.dispatch({ type: 'signOut' }))}
        />
      </View>
    </Screen>
  );
}
