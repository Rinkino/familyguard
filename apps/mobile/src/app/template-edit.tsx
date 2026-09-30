import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Row, Screen, Section, T, Toggle, TopBar, confirm } from '@/components/ui';
import { useStore } from '@/state/store';
import { space } from '@/theme';

export default function TemplateEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const existing = store.templates.find((t) => t.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [shareByDefault, setShareByDefault] = useState(existing?.shareByDefault ?? true);
  const usedBy = existing ? store.people.filter((p) => p.templateId === existing.id).length : 0;

  const save = () => {
    store.dispatch({
      type: 'saveTemplate',
      template: { id: existing?.id ?? `t-${Date.now()}`, name: name.trim(), builtIn: false, shareByDefault },
    });
    router.back();
  };

  return (
    <Screen>
      <TopBar close title={existing ? 'Edit label' : 'New label'} />
      <View style={{ marginTop: space.lg }}>
        <Field label="Label" value={name} onChangeText={setName} placeholder="e.g. Aunty, Coach, Big bro" autoFocus={!existing} />
      </View>

      <Section note="Used when you add someone with this label. You can still change it per person.">
        <Row last>
          <T v="bodyStrong" style={{ flex: 1 }}>Share your location by default</T>
          <Toggle value={shareByDefault} onChange={setShareByDefault} />
        </Row>
      </Section>

      {existing && usedBy > 0 && (
        <T v="small" style={{ marginTop: space.md }}>
          Renaming updates the label for the {usedBy} {usedBy === 1 ? 'person' : 'people'} using it.
        </T>
      )}

      <View style={{ marginTop: space.xl, gap: space.sm }}>
        <Button label={existing ? 'Save label' : 'Create label'} disabled={!name.trim()} onPress={save} />
        {existing && (
          <Button
            kind="danger"
            label="Delete label"
            onPress={() =>
              confirm(`Delete ${existing.name}?`, 'People with this label keep it as a custom label.', 'Delete', () => {
                store.dispatch({ type: 'deleteTemplate', templateId: existing.id });
                router.back();
              })
            }
          />
        )}
      </View>
    </Screen>
  );
}
