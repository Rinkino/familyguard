import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View, type LayoutChangeEvent } from 'react-native';
import { useColors } from '@/theme';

/**
 * The two-way link between you and someone.
 * Left half = your location going to them. Right half = theirs coming to you.
 * Solid when shared, dashed when not.
 */
export function BondLine({
  iShare,
  theyShare,
  thickness = 3,
  dots = true,
  drawIn = false,
}: {
  iShare: boolean;
  theyShare: boolean;
  thickness?: number;
  dots?: boolean;
  drawIn?: boolean;
}) {
  const c = useColors();
  const dot = thickness * 3;
  const progress = useRef(new Animated.Value(drawIn ? 0 : 1)).current;

  useEffect(() => {
    if (!drawIn) return;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return progress.setValue(1);
      Animated.timing(progress, { toValue: 1, duration: 900, delay: 250, useNativeDriver: false }).start();
    });
  }, [drawIn, progress]);

  const label = `${iShare ? 'You share your location' : 'You do not share your location'}. ${
    theyShare ? 'They share theirs with you' : 'They do not share theirs with you'
  }.`;

  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
      {dots && <Dot size={dot} color={iShare ? c.beaconText : c.moss} />}
      <Animated.View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          transform: [{ scaleX: progress }],
          transformOrigin: 'left',
        }}
      >
        <Segment on={iShare} thickness={thickness} color={c.beaconText} off={c.moss} />
        <View style={{ width: thickness * 2 }} />
        <Segment on={theyShare} thickness={thickness} color={c.beaconText} off={c.moss} />
      </Animated.View>
      {dots && <Dot size={dot} color={theyShare ? c.beaconText : c.moss} />}
    </View>
  );
}

function Dot({ size, color }: { size: number; color: string }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

// RN's dashed borders are unreliable on single sides, so dashes are drawn as views.
function Segment({ on, thickness, color, off }: { on: boolean; thickness: number; color: string; off: string }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const dash = thickness * 2.2;
  const gap = thickness * 1.8;
  const count = Math.max(1, Math.floor((width + gap) / (dash + gap)));

  return (
    <View onLayout={onLayout} style={{ flex: 1, height: thickness, flexDirection: 'row', justifyContent: 'space-between' }}>
      {on ? (
        <View style={{ flex: 1, backgroundColor: color, borderRadius: thickness }} />
      ) : (
        width > 0 &&
        Array.from({ length: count }).map((_, i) => (
          <View key={i} style={{ width: dash, height: thickness, borderRadius: thickness, backgroundColor: off }} />
        ))
      )}
    </View>
  );
}
