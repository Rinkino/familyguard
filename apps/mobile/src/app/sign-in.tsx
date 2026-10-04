import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { BondLine } from '@/components/BondLine';
import { Logo } from '@/components/Logo';
import { Avatar, Button, Field, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { space, useColors, type Colors } from '@/theme';

// Apple sign-in needs a paid Apple Developer account; hidden until then.
const APPLE_SIGN_IN_READY = false;

const SLIDES: { title: string; body: string; art: (c: Colors) => React.ReactNode }[] = [
  {
    title: 'Stay close to your people',
    body: 'Share where you are with the people you choose. You decide, and you can change it any time.',
    art: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar name="Tobi Adewale" tint={0} size={64} />
        <BondLine iShare theyShare thickness={4} dots={false} drawIn />
        <Avatar name="Ada Okafor" tint={2} size={64} />
      </View>
    ),
  },
  {
    title: 'Know when someone leaves a safe place',
    body: "Put a zone around school or home. If they leave it, you're told, and they're asked if they're OK.",
    art: (c) => (
      <Svg width={220} height={160} viewBox="0 0 220 160">
        <Circle cx={90} cy={80} r={62} fill={c.beaconSoft} stroke={c.beacon} strokeWidth={3} />
        <Path d="M112 70 C140 60 160 70 176 54" fill="none" stroke={c.flare} strokeWidth={3} strokeDasharray="5 6" strokeLinecap="round" />
        <Circle cx={180} cy={50} r={13} fill={c.flare} stroke="#FFFFFF" strokeWidth={4} />
        <Circle cx={90} cy={80} r={6} fill={c.beacon} />
      </Svg>
    ),
  },
  {
    title: "Help comes, even if you can't ask",
    body: 'No answer means your people get an SOS with your location, and audio starts recording for them.',
    art: (c) => (
      <View style={{ gap: space.sm, alignItems: 'flex-start' }}>
        <View style={{ backgroundColor: c.flare, borderRadius: 24, paddingHorizontal: space.lg, height: 48, justifyContent: 'center' }}>
          <T v="bodyStrong" color="#FFFFFF">SOS sent to Mum and Tolu</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: c.surface, borderRadius: 24, paddingHorizontal: space.md, height: 40 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.flare }} />
          <T v="smallStrong">Recording audio 0:24</T>
        </View>
      </View>
    ),
  },
];

export default function SignIn() {
  const c = useColors();
  const auth = useAuth();
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
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

        <View style={{ flex: 1 }} onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
          {pageWidth > 0 && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
              onScroll={(e) => Platform.OS === 'web' && setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
              scrollEventThrottle={100}
            >
              {SLIDES.map((slide) => (
                <View key={slide.title} style={{ width: pageWidth, paddingHorizontal: space.lg, justifyContent: 'center', gap: space.md }}>
                  <View style={{ height: 160, justifyContent: 'center' }}>{slide.art(c)}</View>
                  <T v="display" style={{ maxWidth: 480 }}>{slide.title}</T>
                  <T v="body" color={c.muted} style={{ maxWidth: 420 }}>{slide.body}</T>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: space.md }}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.title}
              style={{ width: i === page ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? c.beacon : c.hairline }}
            />
          ))}
        </View>

        <View style={{ paddingHorizontal: space.lg, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
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
