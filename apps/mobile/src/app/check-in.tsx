import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T } from '@/components/ui';
import { formatRemaining, useNow, useStore, whoName } from '@/state/store';
import { fonts, space, useColors } from '@/theme';

/** Your side of a zone alert: "Are you OK?" countdown, then SOS. */
export default function CheckIn() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const now = useNow();
  const alert = store.alerts.find((a) => a.forId === 'me' && a.stage !== 'resolved');
  const zone = store.zones.find((z) => z.id === alert?.zoneId);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!alert || !zone) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: space.lg, paddingTop: insets.top + space.xxl, gap: space.md }}>
        <T v="title">You're all clear</T>
        <T v="body" color={c.muted}>No one is being alerted about you right now.</T>
        <Button label="Back to map" onPress={close} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  const watchers = [zone.setById, ...zone.watcherIds]
    .filter((w, i, all) => w !== 'me' && all.indexOf(w) === i)
    .map((w) => whoName(store.people, w));
  const watcherText =
    watchers.length > 1 ? `${watchers.slice(0, -1).join(', ')} and ${watchers[watchers.length - 1]}` : watchers[0] ?? 'Your watchers';
  const secondsLeft = alert.stageEndsAt ? Math.max(0, Math.ceil((alert.stageEndsAt - now) / 1000)) : 0;

  const ok = () => {
    store.dispatch({ type: 'sayOk', alertId: alert.id });
    close();
  };
  const helpNow = () => store.dispatch({ type: 'sosNow', alertId: alert.id, now: Date.now() });

  if (alert.stage === 'left') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: space.lg, paddingTop: insets.top + space.xxl, gap: space.md }}>
        <T v="title">You left {zone.name}</T>
        <T v="body" color={c.muted}>
          {watcherText} {watchers.length > 1 ? 'have' : 'has'} been told. Head back, or we'll ask if you're OK in{' '}
          {formatRemaining((alert.stageEndsAt ?? now) - now)}.
        </T>
        <Button label="I'm OK" onPress={ok} style={{ marginTop: space.lg }} />
        <Button kind="danger" label="I need help now" onPress={helpNow} />
        <T v="smallStrong" color={c.muted} style={{ marginTop: space.lg }}>Demo</T>
        <Button
          kind="secondary"
          label="Go back inside"
          onPress={() => {
            store.dispatch({ type: 'backInside', alertId: alert.id });
            close();
          }}
        />
      </View>
    );
  }

  if (alert.stage === 'checking') {
    return (
      <View style={{ flex: 1, backgroundColor: c.flare, paddingHorizontal: space.lg, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }}>
        <T v="title" color="#FFFFFF">Are you OK?</T>
        <T v="body" color="#FFFFFF" style={{ marginTop: space.sm, opacity: 0.9 }}>
          You left {zone.name}. If you don't answer, {watcherText} will get an SOS with your location, and audio will start recording.
        </T>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <T v="display" color="#FFFFFF" style={{ fontFamily: fonts.heavy, fontSize: 160, lineHeight: 170, letterSpacing: -6 }}>
            {secondsLeft}
          </T>
          <T v="bodyStrong" color="#FFFFFF">seconds</T>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={ok}
          style={({ pressed }) => ({
            height: 72,
            borderRadius: 36,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <T v="heading" color={c.flare} style={{ fontSize: 22 }}>I'm OK</T>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={helpNow} style={{ alignItems: 'center', paddingVertical: space.lg }}>
          <T v="bodyStrong" color="#FFFFFF">I need help now</T>
        </Pressable>
      </View>
    );
  }

  // SOS sent
  return (
    <View style={{ flex: 1, backgroundColor: '#14231E', paddingHorizontal: space.lg, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }}>
      <T v="title" color="#FFFFFF">SOS sent</T>
      <T v="body" color="#C9D6CF" style={{ marginTop: space.sm }}>
        {watcherText} can see where you are. Keep your phone with you.
      </T>

      <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
        <Recording since={alert.sosAt ?? now} now={now} />
        <T v="small" color="#C9D6CF">Audio is shared with {watcherText} when you have signal.</T>
      </View>

      <Button
        kind="secondary"
        label="I'm safe now"
        onPress={() => {
          store.dispatch({ type: 'markSafe', alertId: alert.id });
          close();
        }}
      />
      <Pressable accessibilityRole="button" onPress={close} style={{ alignItems: 'center', paddingVertical: space.lg }}>
        <T v="bodyStrong" color="#FFFFFF">Back to map</T>
      </Pressable>
    </View>
  );
}

function Recording({ since, now }: { since: number; now: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [pulse]);

  const s = Math.max(0, Math.floor((now - since) / 1000));
  const elapsed = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View
      accessible
      accessibilityLabel={`Recording audio, ${elapsed}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: '#1F3129', borderRadius: 20, padding: space.lg }}
    >
      <Animated.View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#F0714D', opacity: pulse }} />
      <T v="bodyStrong" color="#FFFFFF" style={{ flex: 1 }}>Recording audio</T>
      <T v="heading" color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }}>{elapsed}</T>
    </View>
  );
}
