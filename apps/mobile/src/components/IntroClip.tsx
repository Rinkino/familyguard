import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import { space, useColors } from '@/theme';
import { BondLine } from './BondLine';
import { Avatar, T } from './ui';

const SCENE_MS = 4500;

const SCENES = [
  {
    title: 'Stay close to your people',
    body: 'Share where you are with the people you choose. You decide, and you can change it any time.',
  },
  {
    title: 'Know when someone leaves a safe place',
    body: "Put a zone around school or home. If they leave it, you're told, and they're asked if they're OK.",
  },
  {
    title: "Help comes, even if you can't ask",
    body: 'No answer means your people get an SOS with your location, and audio starts recording for them.',
  },
];

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Animated value that runs 0 → 1 once on mount (or jumps to 1 with reduced motion). */
function useIntro(duration: number, delay = 0, reduce = false, easing = Easing.out(Easing.cubic)) {
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return v.setValue(1);
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [v, duration, delay, reduce, easing]);
  return v;
}

/**
 * A short self-playing intro: three scenes with story-style progress bars.
 * Advances every 4.5 s and loops; tap to skip ahead.
 */
export function IntroClip() {
  const c = useColors();
  const reduce = useReduceMotion();
  const [scene, setScene] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const textIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    textIn.setValue(reduce ? 1 : 0);
    const bar = Animated.timing(progress, { toValue: 1, duration: SCENE_MS, easing: Easing.linear, useNativeDriver: false });
    bar.start(({ finished }) => finished && setScene((s) => (s + 1) % SCENES.length));
    if (!reduce) Animated.timing(textIn, { toValue: 1, duration: 450, delay: 150, useNativeDriver: false }).start();
    return () => bar.stop();
  }, [scene, reduce, progress, textIn]);

  const { title, body } = SCENES[scene];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body} Tap for the next part.`}
      onPress={() => setScene((s) => (s + 1) % SCENES.length)}
      style={{ flex: 1, paddingHorizontal: space.lg }}
    >
      <View style={{ flexDirection: 'row', gap: 6, marginTop: space.md }}>
        {SCENES.map((s, i) => (
          <View key={s.title} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: c.hairline, overflow: 'hidden' }}>
            <Animated.View
              style={{
                height: 4,
                backgroundColor: c.beacon,
                width: i < scene ? '100%' : i > scene ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }}
            />
          </View>
        ))}
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
        <View style={{ height: 180, justifyContent: 'center' }}>
          {scene === 0 && <ConnectScene key="connect" reduce={reduce} />}
          {scene === 1 && <ZoneScene key="zone" reduce={reduce} />}
          {scene === 2 && <SosScene key="sos" reduce={reduce} />}
        </View>
        <Animated.View
          style={{
            gap: space.md,
            opacity: textIn,
            transform: [{ translateY: textIn.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          }}
        >
          <T v="display" style={{ maxWidth: 480 }}>{title}</T>
          <T v="body" color={c.muted} style={{ maxWidth: 420 }}>{body}</T>
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** Two people slide together and the sharing line draws between them. */
function ConnectScene({ reduce }: { reduce: boolean }) {
  const t = useIntro(600, 0, reduce);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Animated.View style={{ opacity: t, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }] }}>
        <Avatar name="Tobi Adewale" tint={0} size={64} />
      </Animated.View>
      <BondLine iShare theyShare thickness={4} dots={false} drawIn={!reduce} />
      <Animated.View style={{ opacity: t, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }}>
        <Avatar name="Ada Okafor" tint={2} size={64} />
      </Animated.View>
    </View>
  );
}

/** A zone appears, a person walks out of it and turns red, an alert pops up. */
function ZoneScene({ reduce }: { reduce: boolean }) {
  const c = useColors();
  const zone = useIntro(500, 0, reduce);
  const walk = useIntro(1700, 600, reduce, Easing.inOut(Easing.quad));
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(ripple, { toValue: 1, duration: 1100, useNativeDriver: false }));
    const t = setTimeout(() => loop.start(), 2300);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [ripple, reduce]);

  const R = 70; // zone radius
  const center = { x: 100, y: 90 };
  const end = { x: 220, y: 40 };
  const dot = 22;
  const x = walk.interpolate({ inputRange: [0, 1], outputRange: [center.x, end.x] });
  const y = walk.interpolate({ inputRange: [0, 1], outputRange: [center.y, end.y] });
  const color = walk.interpolate({ inputRange: [0, 0.5, 0.62, 1], outputRange: [c.beaconText, c.beaconText, c.flare, c.flare] });
  const alertIn = walk.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 0, 1] });

  return (
    <View style={{ width: 320, height: 180 }}>
      <Animated.View
        style={{
          position: 'absolute',
          left: center.x - R,
          top: center.y - R,
          width: R * 2,
          height: R * 2,
          borderRadius: R,
          backgroundColor: c.beaconSoft,
          borderWidth: 3,
          borderColor: c.beacon,
          opacity: zone,
          transform: [{ scale: zone.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: dot * 3,
          height: dot * 3,
          borderRadius: dot * 1.5,
          borderWidth: 2,
          borderColor: c.flare,
          left: end.x - dot * 1.5,
          top: end.y - dot * 1.5,
          opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.4] }) }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          borderWidth: 3,
          borderColor: '#FFFFFF',
          backgroundColor: color,
          transform: [{ translateX: Animated.subtract(x, dot / 2) }, { translateY: Animated.subtract(y, dot / 2) }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          left: 174,
          top: 70,
          width: 140,
          alignItems: 'center',
          opacity: alertIn,
          transform: [{ translateY: alertIn.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          backgroundColor: c.flareSoft,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
      >
        <T v="smallStrong" color={c.flare} numberOfLines={1}>Ada left School</T>
      </Animated.View>
    </View>
  );
}

/** The SOS banner pops in, then recording starts and the timer runs. */
function SosScene({ reduce }: { reduce: boolean }) {
  const c = useColors();
  const pop = useIntro(450, 100, reduce, Easing.out(Easing.back(1.6)));
  const rec = useIntro(400, 900, reduce);
  const pulse = useRef(new Animated.Value(1)).current;
  const [secs, setSecs] = useState(reduce ? 24 : 0);

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 600, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: false }),
      ])
    );
    loop.start();
    const timer = { current: undefined as ReturnType<typeof setInterval> | undefined };
    const start = setTimeout(() => {
      timer.current = setInterval(() => setSecs((s) => s + 1), 400); // runs fast so it reads as live
    }, 1000);
    return () => {
      loop.stop();
      clearTimeout(start);
      if (timer.current) clearInterval(timer.current);
    };
  }, [pulse, reduce]);

  return (
    <View style={{ gap: space.sm, alignItems: 'flex-start' }}>
      <Animated.View
        style={{
          backgroundColor: c.flare,
          borderRadius: 24,
          paddingHorizontal: space.lg,
          height: 52,
          justifyContent: 'center',
          opacity: pop,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }}
      >
        <T v="bodyStrong" color="#FFFFFF">SOS sent to Mum and Tolu</T>
      </Animated.View>
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          backgroundColor: c.surface,
          borderRadius: 24,
          paddingHorizontal: space.md,
          height: 44,
          opacity: rec,
          transform: [{ translateY: rec.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
        <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.flare, opacity: pulse }} />
        <T v="smallStrong">
          Recording audio {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
        </T>
      </Animated.View>
    </View>
  );
}
