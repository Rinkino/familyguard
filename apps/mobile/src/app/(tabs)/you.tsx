import { router } from 'expo-router';
import { View } from 'react-native';
import { Avatar, Button, Icon, Row, Screen, Section, T, Toggle, confirm, attempt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { myGuardians, useStore } from '@/state/store';
import { space, useColors } from '@/theme';

export default function You() {
  const c = useColors();
  const store = useStore();
  const auth = useAuth();
  const custom = store.templates.filter((t) => !t.builtIn).length;

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: space.xl, gap: space.sm }}>
        <Avatar name={store.me.name} tint={store.me.tint} size={88} />
        <T v="title">{store.me.name}</T>
        <T v="body" color={c.muted}>{store.me.email}</T>
      </View>

      <Section
        note={
          myGuardians(store.people).length > 0
            ? 'While paused, only your guardians can see your location.'
            : 'While paused, nobody can see your location. Your settings are kept for when you resume.'
        }
      >
        <Row last>
          <Icon name="pause-circle" color={store.pausedAll ? c.flare : c.muted} />
          <T v="bodyStrong" style={{ flex: 1 }}>Pause sharing with everyone</T>
          <Toggle value={store.pausedAll} onChange={(v) => attempt(store.actions.setPausedAll(v))} />
        </Row>
      </Section>

      {store.queued > 0 && (
        <Section note="They upload automatically when your phone is back online.">
          <Row last>
            <Icon name="wifi-off" color={c.flare} />
            <T v="body" style={{ flex: 1 }}>
              Offline. {store.queued} {store.queued === 1 ? 'location' : 'locations'} saved on this phone.
            </T>
          </Row>
        </Section>
      )}

      <Section title="Safety">
        <Row onPress={() => router.push('/history/me')}>
          <Icon name="clock" />
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">Your location history</T>
            <T v="small" color={c.muted}>Last 7 days. If your phone is lost, sign in on another phone to see where it was.</T>
          </View>
          <Icon name="chevron-right" />
        </Row>
        <Row last onPress={() => router.push('/recordings')}>
          <Icon name="mic" />
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">Recordings</T>
            <T v="small" color={c.muted}>Audio from SOS alerts. Play, name, save or delete.</T>
          </View>
          <Icon name="chevron-right" />
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

      <Section title="Your code" note="Give this to someone so they can add you.">
        <Row last onPress={() => router.push('/add-person')}>
          <Icon name="share-2" />
          <T v="bodyStrong" style={{ flex: 1, letterSpacing: 2 }}>{store.me.inviteCode}</T>
          <Icon name="chevron-right" />
        </Row>
      </Section>

      {store.permission === 'denied' && (
        <Section title="Location" note="Turn on location for this app in your phone's Settings so people you share with can see you.">
          <Row last>
            <Icon name="alert-circle" color={c.flare} />
            <T v="body" style={{ flex: 1 }}>Location access is off</T>
          </Row>
        </Section>
      )}

      <View style={{ marginTop: space.xl }}>
        <Button
          kind="secondary"
          label="Sign out"
          onPress={() =>
            confirm('Sign out?', 'You can sign back in any time.', 'Sign out', async () => {
              await auth.signOut();
            })
          }
        />
      </View>
    </Screen>
  );
}
