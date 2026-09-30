import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { Template } from '@/mock/data';
import { space, type, useColors } from '@/theme';
import { T } from './ui';

/** Pick one of your templates, or type a one-off label. */
export function LabelPicker({
  templates,
  label,
  templateId,
  onChange,
}: {
  templates: Template[];
  label: string;
  templateId?: string;
  onChange: (label: string, templateId?: string) => void;
}) {
  const c = useColors();
  const [custom, setCustom] = useState(templateId ? '' : label);
  const groups = [
    { title: 'Yours', items: templates.filter((t) => !t.builtIn) },
    { title: 'Built in', items: templates.filter((t) => t.builtIn) },
  ].filter((g) => g.items.length > 0);

  return (
    <View style={{ marginTop: space.lg, gap: space.lg }}>
      {groups.map((g) => (
        <View key={g.title} style={{ gap: space.sm }}>
          <T v="smallStrong" color={c.muted}>{g.title}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {g.items.map((t) => {
              const selected = t.id === templateId;
              return (
                <Pressable
                  key={t.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setCustom('');
                    onChange(t.name, t.id);
                  }}
                  style={{
                    paddingHorizontal: space.md,
                    height: 40,
                    borderRadius: 20,
                    justifyContent: 'center',
                    backgroundColor: selected ? c.beacon : c.surface,
                    borderWidth: 1,
                    borderColor: selected ? c.beacon : c.hairline,
                  }}
                >
                  <T v="smallStrong" color={selected ? c.onBeacon : c.ink}>{t.name}</T>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <View style={{ gap: space.sm }}>
        <T v="smallStrong" color={c.muted}>Or type your own</T>
        <TextInput
          value={custom}
          onChangeText={(v) => {
            setCustom(v);
            onChange(v, undefined);
          }}
          placeholder="e.g. Aunty Bisi, Gym buddy"
          placeholderTextColor={c.moss}
          style={[
            type.body,
            {
              color: c.ink,
              backgroundColor: c.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: !templateId && custom ? c.beacon : c.hairline,
              paddingHorizontal: space.md,
              height: 52,
            },
          ]}
        />
      </View>
    </View>
  );
}
