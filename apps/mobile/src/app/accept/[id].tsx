import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { LabelPicker } from '@/components/LabelPicker';
import { Avatar, Button, Row, Screen, Section, T, Toggle, TopBar } from '@/components/ui';
import { firstName, useStore } from '@/state/store';
import { space, useColors } from '@/theme';

/** Accept someone's request: pick your own label for them and your sharing. */
export default function AcceptRequest() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const person = store.people.find((p) => p.id === id && p.status === 'incoming');
  const [label, setLabel] = useState('');
  const [templateId, setTemplateId] = useState<string>();
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!person) {
    return (
      <Screen>
        <TopBar close />
        <T v="heading" style={{ marginTop: space.lg }}>This request is no longer waiting.</T>
      </Screen>
    );
  }
  const name = firstName(person.name);

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      await store.actions.accept(person.id, label.trim(), templateId, share);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't accept. Try again.");
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar close title="Accept request" />
      <Section>
        <Row last>
          <Avatar name={person.name} tint={person.tint} />
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">{person.name}</T>
            <T v="small" color={c.muted}>Wants to connect with you</T>
          </View>
        </Row>
      </Section>

      <T v="heading" style={{ marginTop: space.lg }}>What do you call {name}?</T>
      <T v="small" color={c.muted}>Only you see this.</T>
      <LabelPicker
        templates={store.templates}
        label={label}
        templateId={templateId}
        onChange={(l, t) => {
          setLabel(l);
          setTemplateId(t);
          const tpl = store.templates.find((x) => x.id === t);
          if (tpl) setShare(tpl.shareByDefault);
        }}
      />

      <Section note="You can change this any time.">
        <Row last>
          <T v="bodyStrong" style={{ flex: 1 }}>Share your location with {name}</T>
          <Toggle value={share} onChange={setShare} />
        </Row>
      </Section>

      <View style={{ marginTop: space.xl, gap: space.sm }}>
        <Button label={busy ? 'Accepting…' : 'Accept'} disabled={!label.trim() || busy} onPress={accept} />
        {error ? <T v="small" color={c.flare}>{error}</T> : null}
      </View>
    </Screen>
  );
}
