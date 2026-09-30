import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { LabelPicker } from '@/components/LabelPicker';
import { Button, Screen, T, TopBar } from '@/components/ui';
import { firstName, useStore } from '@/state/store';
import { space, useColors } from '@/theme';

export default function ChangeLabel() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const person = store.people.find((p) => p.id === id);
  const [label, setLabel] = useState(person?.label ?? '');
  const [templateId, setTemplateId] = useState<string | undefined>(person?.templateId);

  if (!person) return null;
  const name = firstName(person.name);

  return (
    <Screen>
      <TopBar close title="Your label" />
      <T v="title" style={{ marginTop: space.md }}>What do you call {name}?</T>
      <T v="body" color={c.muted} style={{ marginTop: space.xs }}>Only you see this.</T>

      <LabelPicker
        templates={store.templates}
        label={label}
        templateId={templateId}
        onChange={(l, t) => {
          setLabel(l);
          setTemplateId(t);
        }}
      />

      <View style={{ marginTop: space.xl }}>
        <Button
          label="Save label"
          disabled={!label.trim()}
          onPress={() => {
            store.dispatch({ type: 'setLabel', personId: person.id, label: label.trim(), templateId });
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}
