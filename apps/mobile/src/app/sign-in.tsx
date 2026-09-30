import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { BondLine } from '@/components/BondLine';
import { Avatar, Button, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/state/store';
import { space, useColors } from '@/theme';

// Real sign-in (Google + email link) when Supabase is configured; simulated otherwise.
export default function SignIn() {
  const c = useColors();
  const auth = useAuth();
  const { dispatch } = useStore();
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState('');

  const demoSignIn = (address: string) => dispatch({ type: 'signIn', email: address });
  const validEmail = /\S+@\S+\.\S+/.test(email);

  const google = async () => {
    if (!auth.enabled) return demoSignIn('you@gmail.com');
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
    if (!auth.enabled) return setSent(true);
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
            {/* Apple needs a paid Apple Developer account; demo mode only for now. */}
            {!auth.enabled && Platform.OS !== 'android' && (
              <Button
                kind="ink"
                label="Continue with Apple"
                icon={<FontAwesome name="apple" size={18} color={c.bg} />}
                onPress={() => demoSignIn('you@icloud.com')}
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
            {!auth.enabled && (
              <Button label="Open link (demo)" onPress={() => demoSignIn(email)} style={{ marginTop: space.md }} />
            )}
            <Button kind="plain" label="Use a different email" onPress={() => setSent(false)} />
          </>
        )}

        {error ? <T v="small" color={c.flare} style={{ textAlign: 'center' }}>{error}</T> : null}
      </View>

      {!auth.enabled && (
        <T v="tiny" color={c.muted} style={{ textAlign: 'center', marginTop: space.lg }}>
          Demo build. Sign-in is simulated and no data leaves this device.
        </T>
      )}
    </Screen>
  );
}
