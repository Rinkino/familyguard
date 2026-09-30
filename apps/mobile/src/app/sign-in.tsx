import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { BondLine } from '@/components/BondLine';
import { Avatar, Button, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { space, useColors } from '@/theme';

// Apple sign-in needs a paid Apple Developer account; hidden until then.
const APPLE_SIGN_IN_READY = false;

export default function SignIn() {
  const c = useColors();
  const auth = useAuth();
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState('');

  // Without Supabase keys there's no account system to sign in to.
  const notConfigured = () => setError('Sign-in is not set up. Add the Supabase keys to apps/mobile/.env.');
  const validEmail = /\S+@\S+\.\S+/.test(email);

  const google = async () => {
    if (!auth.enabled) return notConfigured();
    setError('');
    setBusy('google');
    try {
      await auth.signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const sendLink = async () => {
    if (!auth.enabled) return notConfigured();
    setError('');
    setBusy('email');
    try {
      await auth.sendMagicLink(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the link. Check the address and try again.");
    } finally {
      setBusy(null);
    }
  };

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
            {APPLE_SIGN_IN_READY && Platform.OS !== 'android' && (
              <Button
                kind="ink"
                label="Continue with Apple"
                icon={<FontAwesome name="apple" size={18} color={c.bg} />}
                onPress={notConfigured}
              />
            )}
            <Button
              kind="secondary"
              label="Continue with Google"
              disabled={busy !== null}
              icon={busy === 'google' ? <ActivityIndicator color={c.ink} /> : <FontAwesome name="google" size={16} color={c.ink} />}
              onPress={google}
            />
            <Button kind="plain" label="Use email instead" onPress={() => { setError(''); setEmailMode(true); }} />
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
            <Button
              label={busy === 'email' ? 'Sending…' : 'Send sign-in link'}
              disabled={!validEmail || busy !== null}
              onPress={sendLink}
              style={{ marginTop: space.sm }}
            />
            <Button kind="plain" label="Back" onPress={() => { setError(''); setEmailMode(false); }} />
          </>
        ) : (
          <>
            <T v="heading">Check your email</T>
            <T v="body" color={c.muted}>
              We sent a sign-in link to {email}. Open it on this phone to continue.
            </T>
            <Button kind="plain" label="Use a different email" onPress={() => setSent(false)} />
          </>
        )}

        {error ? <T v="small" color={c.flare} style={{ textAlign: 'center' }}>{error}</T> : null}
      </View>

    </Screen>
  );
}
