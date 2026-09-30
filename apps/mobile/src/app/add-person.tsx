import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { LabelPicker } from '@/components/LabelPicker';
import { Avatar, Button, Field, Row, Screen, Section, T, Toggle, TopBar } from '@/components/ui';
import { firstName, lookupInviteCode, useStore } from '@/state/store';
import { fonts, space, useColors } from '@/theme';

type Mode = 'mine' | 'theirs';

export default function AddPerson() {
  const c = useColors();
  const store = useStore();
  const [mode, setMode] = useState<Mode>('mine');
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [templateId, setTemplateId] = useState<string>();
  const [share, setShare] = useState(false);

  const found = lookupInviteCode(code);
  const inviteLink = `https://familyguard.app/i/${store.me.inviteCode}`;

  const copy = async () => {
    await Clipboard.setStringAsync(store.me.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const send = () => {
    if (!found) return;
    store.dispatch({
      type: 'addPending',
      person: {
        id: `p-${Date.now()}`,
        name: found.name,
        tint: found.tint,
        label: label.trim(),
        templateId,
        iShare: share,
        theyShare: false,
        status: 'pending',
      },
    });
    router.back();
  };

  return (
    <Screen>
      <TopBar close title="Add person" />

      <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: 24, padding: 4, marginTop: space.sm }}>
        {(
          [
            ['mine', 'Share my code'],
            ['theirs', 'Enter their code'],
          ] as const
        ).map(([m, text]) => (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            onPress={() => setMode(m)}
            style={{ flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === m ? c.ink : 'transparent' }}
          >
            <T v="smallStrong" color={mode === m ? c.bg : c.muted}>{text}</T>
          </Pressable>
        ))}
      </View>

      {mode === 'mine' ? (
        <View style={{ marginTop: space.xl, gap: space.lg }}>
          <T v="body" color={c.muted}>Send this code to someone. When they enter it, you'll both pick a label and choose what to share.</T>
          <View style={{ backgroundColor: c.surface, borderRadius: 24, paddingVertical: space.xl, alignItems: 'center', gap: space.sm }}>
            <T v="small" color={c.muted}>Your code</T>
            <T v="display" style={{ fontFamily: fonts.heavy, fontSize: 48, lineHeight: 54, letterSpacing: 4 }}>{store.me.inviteCode}</T>
            <T v="tiny" color={c.muted}>Expires in 7 days</T>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button kind="secondary" label={copied ? 'Copied' : 'Copy code'} onPress={copy} style={{ flex: 1 }} />
            <Button
              label="Send link"
              onPress={() => Share.share({ message: `Add me on FamilyGuard with code ${store.me.inviteCode}: ${inviteLink}` })}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: space.xl, gap: space.lg }}>
          <Field
            label="Their code"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="e.g. QM4-81Z"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />
          {code.length > 0 && !found && <T v="small" color={c.muted}>Codes are 6 letters or numbers. Try any code for the demo.</T>}

          {found && (
            <>
              <Section>
                <Row last>
                  <Avatar name={found.name} tint={found.tint} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{found.name}</T>
                    <T v="small" color={c.muted}>Found from code {code}</T>
                  </View>
                </Row>
              </Section>

              <View>
                <T v="heading">What do you call {firstName(found.name)}?</T>
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
              </View>

              <Section note="You can change this any time.">
                <Row last>
                  <T v="bodyStrong" style={{ flex: 1 }}>Share your location with {firstName(found.name)}</T>
                  <Toggle value={share} onChange={setShare} />
                </Row>
              </Section>

              <Button label="Send request" disabled={!label.trim()} onPress={send} />
            </>
          )}
        </View>
      )}
    </Screen>
  );
}
