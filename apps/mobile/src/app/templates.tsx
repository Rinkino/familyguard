import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Icon, Row, Screen, Section, T, TopBar } from '@/components/ui';
import type { Template } from '@/types';
import { useStore } from '@/state/store';
import { space, useColors } from '@/theme';

export default function Templates() {
  const c = useColors();
  const store = useStore();
  const mine = store.templates.filter((t) => !t.builtIn);
  const builtIn = store.templates.filter((t) => t.builtIn);
  const usage = (t: Template) => store.people.filter((p) => p.templateId === t.id).length;

  const renderRow = (t: Template, i: number, list: Template[]) => (
    <Row
      key={t.id}
      last={i === list.length - 1}
      onPress={t.builtIn ? undefined : () => router.push({ pathname: '/template-edit', params: { id: t.id } })}
    >
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{t.name}</T>
        <T v="small" color={c.muted}>
          {t.shareByDefault ? 'Shares your location by default' : "Doesn't share by default"}
          {usage(t) > 0 ? `. Used for ${usage(t)}.` : ''}
        </T>
      </View>
      {!t.builtIn && <Icon name="chevron-right" />}
    </Row>
  );

  return (
    <Screen>
      <TopBar />
      <T v="title" style={{ marginTop: space.md }}>Your labels</T>
      <T v="body" color={c.muted} style={{ marginTop: space.xs }}>
        A label is what you call someone, plus whether you share with them by default. Only you see them.
      </T>

      <Section title="Yours">
        {mine.length ? (
          mine.map(renderRow)
        ) : (
          <Row last>
            <T v="body" color={c.muted}>Make labels like Aunty, Coach or Big bro.</T>
          </Row>
        )}
      </Section>

      <View style={{ marginTop: space.md }}>
        <Button kind="secondary" label="New label" onPress={() => router.push('/template-edit')} />
      </View>

      <Section title="Built in">{builtIn.map(renderRow)}</Section>
    </Screen>
  );
}
