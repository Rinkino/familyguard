import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { space, useColors } from '@/theme';

export type Snap = 'peek' | 'half' | 'tall';

const PEEK = 92;

/**
 * Drag-to-resize panel with three resting heights. Drag the top area or flick
 * it; it settles on the nearest height. `above` floats just over the sheet's
 * top edge and moves with it (e.g. map buttons).
 */
export function BottomSheet({
  snap,
  onSnapChange,
  onVisibleHeight,
  header,
  above,
  children,
}: {
  snap: Snap;
  onSnapChange: (s: Snap) => void;
  /** Reports how much of the screen the sheet covers at rest. */
  onVisibleHeight?: (h: number) => void;
  header?: ReactNode;
  above?: ReactNode;
  children: ReactNode;
}) {
  const c = useColors();
  const [areaH, setAreaH] = useState(0);
  const heights = useMemo(
    () => ({ peek: PEEK, half: Math.round(areaH * 0.45), tall: Math.round(areaH * 0.86) }),
    [areaH]
  );
  // translateY: 0 = fully open (tall). Larger = lower.
  const y = useRef(new Animated.Value(0)).current;
  const yNow = useRef(0);
  const startY = useRef(0);
  const offsetFor = (s: Snap) => heights.tall - heights[s];

  useEffect(() => {
    const id = y.addListener(({ value }) => (yNow.current = value));
    return () => y.removeListener(id);
  }, [y]);

  // Settle on the requested height whenever it (or the screen size) changes.
  useEffect(() => {
    if (!areaH) return;
    Animated.spring(y, { toValue: offsetFor(snap), useNativeDriver: false, bounciness: 2, speed: 14 }).start();
    onVisibleHeight?.(heights[snap]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, areaH]);

  // Scroll position of the list inside, so a pull-down at the top of a fully
  // open sheet closes it instead of fighting the scroll.
  const scrollY = useRef(0);

  const settle = (vy: number) => {
    // Project the flick a little forward, then pick the closest height.
    const projected = heights.tall - (yNow.current + vy * 180);
    const order: Snap[] = ['peek', 'half', 'tall'];
    const next = order.reduce((best, s) =>
      Math.abs(heights[s] - projected) < Math.abs(heights[best] - projected) ? s : best
    );
    if (next === snap) {
      Animated.spring(y, { toValue: offsetFor(next), useNativeDriver: false, bounciness: 2, speed: 14 }).start();
    }
    onSnapChange(next);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Claim clearly vertical drags anywhere on the sheet, before buttons or the list do,
        // except when the sheet is fully open and the list is scrolled or being scrolled up.
        onMoveShouldSetPanResponderCapture: (_, g) => {
          const vertical = Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5;
          if (!vertical) return false;
          if (snap !== 'tall') return true;
          return g.dy > 0 && scrollY.current <= 0;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          y.stopAnimation();
          startY.current = yNow.current;
        },
        onPanResponderMove: (_, g) => {
          const max = heights.tall - heights.peek;
          y.setValue(Math.max(0, Math.min(max, startY.current + g.dy)));
        },
        onPanResponderRelease: (_, g) => settle(g.vy),
        onPanResponderTerminate: (_, g) => settle(g.vy),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heights, snap]
  );

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      onLayout={(e: LayoutChangeEvent) => setAreaH(e.nativeEvent.layout.height)}
    >
      {areaH > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: heights.tall,
            transform: [{ translateY: y }],
          }}
        >
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: '100%', paddingBottom: space.sm }}>
            {above}
          </View>
          <View
            {...pan.panHandlers}
            style={{
              flex: 1,
              backgroundColor: c.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: -2 },
              elevation: 8,
            }}
          >
            <View>
              <Pressable
                accessibilityRole="adjustable"
                accessibilityLabel="Panel size"
                accessibilityHint="Drag up or down to resize"
                onPress={() => onSnapChange(snap === 'peek' ? 'half' : snap === 'half' ? 'tall' : 'peek')}
                style={{ alignItems: 'center', paddingVertical: 10 }}
              >
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.hairline }} />
              </Pressable>
              {header}
            </View>
            <ScrollView
              scrollEnabled={snap === 'tall'}
              onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
              scrollEventThrottle={32}
              contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: heights.tall - heights[snap] + space.xl }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
