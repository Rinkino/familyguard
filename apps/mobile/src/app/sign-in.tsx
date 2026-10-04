import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IntroClip } from '@/components/IntroClip';
import { Logo } from '@/components/Logo';
import { Button, Field, T } from '@/components/ui';
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
  const insets = useSafeAreaInsets();

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg }}>
          <Logo size={36} />
          <T v="heading">FamilyGuard</T>
        </View>

        <IntroClip />

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
      <View style={{ gap: space.sm }}>
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
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
