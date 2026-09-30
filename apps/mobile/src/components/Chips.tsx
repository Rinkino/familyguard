import { Pressable, View } from 'react-native';
import { space, useColors } from '@/theme';
import { T } from './ui';

/** Single- or multi-select pill row. */
export function Chips<K extends string | number>({
  options,
  selected,
  onPress,
  multi,
}: {
  options: { key: K; label: string }[];
  selected: K | K[];
  onPress: (key: K) => void;
  multi?: boolean;
}) {
  const c = useColors();
  const isOn = (k: K) => (Array.isArray(selected) ? selected.includes(k) : selected === k);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => {
        const on = isOn(o.key);
        return (
          <Pressable
            key={String(o.key)}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={multi ? { checked: on } : { selected: on }}
            onPress={() => onPress(o.key)}
            style={{
              paddingHorizontal: space.md,
              height: 38,
              borderRadius: 19,
              justifyContent: 'center',
              backgroundColor: on ? c.beacon : c.surface,
              borderWidth: 1,
              borderColor: on ? c.beacon : c.hairline,
            }}
          >
            <T v="smallStrong" color={on ? c.onBeacon : c.ink}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
