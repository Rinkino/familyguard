import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { BondLine } from '@/components/BondLine';
import { Avatar, Button, Field, Screen, T } from '@/components/ui';
import { useStore } from '@/state/store';
import { space, useColors } from '@/theme';

// Sign-in is simulated until Supabase auth is wired up.
export default function SignIn() {
  const c = useColors();
  const { dispatch } = useStore();
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const signIn = (address: string) => dispatch({ type: 'signIn', email: address });
  const validEmail = /\S+@\S+\.\S+/.test(email);

  return (
    <Screen>
      <View style={{ minHeight: 280, justifyContent: 'center', paddingTop: space.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xl }}>
          <Avatar name="You" tint={0} size={56} />
          <BondLine iShare theyShare thickness={4} dots={false} drawIn />
          <Avatar name="Ada Okafor" tint={2} size={56} />
        </View>
        <T v="display">Stay within reach of your people.</T>
        <T v="body" color={c.muted} style={{ marginTop: space.md, maxWidth: 420 }}>
          You choose who sees where you are, and you can change it any time.
        </T>
      </View>

      <View style={{ gap: space.sm, marginTop: space.xl }}>
        {!emailMode ? (
          <>
            {Platform.OS !== 'android' && (
              <Button
                kind="ink"
                label="Continue with Apple"
                icon={<FontAwesome name="apple" size={18} color={c.bg} />}
                onPress={() => signIn('you@icloud.com')}
              />
            )}
            <Button
              kind="secondary"
              label="Continue with Google"
              icon={<FontAwesome name="google" size={16} color={c.ink} />}
              onPress={() => signIn('you@gmail.com')}
            />
            <Button kind="plain" label="Use email instead" onPress={() => setEmailMode(true)} />
          </>
        ) : !sent ? (
          <>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
            />
            <Button label="Send sign-in link" disabled={!validEmail} onPress={() => setSent(true)} style={{ marginTop: space.sm }} />
            <Button kind="plain" label="Back" onPress={() => setEmailMode(false)} />
          </>
        ) : (
          <>
            <T v="heading">Check your email</T>
            <T v="body" color={c.muted}>
              We sent a sign-in link to {email}. Open it on this phone to continue.
            </T>
            <Button label="Open link (demo)" onPress={() => signIn(email)} style={{ marginTop: space.md }} />
            <Button kind="plain" label="Use a different email" onPress={() => setSent(false)} />
          </>
        )}
      </View>

      <T v="tiny" color={c.muted} style={{ textAlign: 'center', marginTop: space.lg }}>
        Demo build. Sign-in is simulated and no data leaves this device.
      </T>
    </Screen>
  );
}
