import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { BondLine } from '@/components/BondLine';
import { Avatar, Button, Field, Screen, T } from '@/components/ui';
import { useStore } from '@/state/store';
import { avatarTints, space, useColors } from '@/theme';

export default function Onboarding() {
  const c = useColors();
  const { dispatch } = useStore();
  const [step, setStep] = useState<'name' | 'lines'>('name');
  const [name, setName] = useState('');
  const [tint, setTint] = useState(0);

  if (step === 'name') {
    return (
      <Screen>
        <View style={{ paddingTop: space.xxl, gap: space.lg }}>
          <T v="title">What should people call you?</T>
          <View style={{ alignItems: 'center', paddingVertical: space.md }}>
            <Avatar name={name || 'You'} tint={tint} size={96} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm }}>
            {avatarTints.map((hex, i) => (
              <Pressable
                key={hex}
                accessibilityRole="radio"
                accessibilityLabel={`Colour ${i + 1}`}
                accessibilityState={{ selected: tint === i }}
                onPress={() => setTint(i)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: hex,
                  borderWidth: 3,
                  borderColor: tint === i ? c.ink : 'transparent',
                }}
              />
            ))}
          </View>
          <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Tobi Adewale" autoFocus />
          <T v="small" color={c.muted}>
            People you connect with see this name. They can give you their own label too.
          </T>
          <Button label="Continue" disabled={name.trim().length < 2} onPress={() => setStep('lines')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: space.xxl, gap: space.lg }}>
        <T v="title">One line tells you who can see who</T>
        <T v="body" color={c.muted}>
          Every person you add has a line between you. The left half is you, the right half is them.
        </T>

        <View style={{ backgroundColor: c.surface, borderRadius: 18, padding: space.md, gap: space.lg }}>
          <Legend iShare theyShare text="Solid both ways. You can see each other." />
          <Legend iShare theyShare={false} text="You share with them. They don't share with you." />
          <Legend iShare={false} theyShare={false} text="Dashed. Nobody is sharing." />
        </View>

        <T v="small" color={c.muted}>
          You only control your half. Nobody can turn on your sharing but you.
        </T>
        <Button label="Get started" onPress={() => dispatch({ type: 'finishOnboarding', name: name.trim(), tint })} />
      </View>
    </Screen>
  );
}

function Legend({ iShare, theyShare, text }: { iShare: boolean; theyShare: boolean; text: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ height: 12, flexDirection: 'row', alignItems: 'center' }}>
        <BondLine iShare={iShare} theyShare={theyShare} />
      </View>
      <T v="small">{text}</T>
    </View>
  );
}
