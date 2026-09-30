import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/schibsted-grotesk';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { StoreProvider, useStore } from '@/state/store';
import { useColors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
  });

  if (!loaded) return null;

  return (
    <AuthProvider>
      <StoreProvider>
        <RootStack />
      </StoreProvider>
    </AuthProvider>
  );
}

function RootStack() {
  const auth = useAuth();
  const store = useStore();
  const { onboarded, alerts, dispatch } = store;
  const c = useColors();
  const scheme = useColorScheme();

  // With Supabase configured, the real session decides who is signed in.
  const signedIn = auth.enabled ? Boolean(auth.session) : store.signedIn;
  const email = auth.session?.user.email;

  useEffect(() => {
    if (auth.ready) SplashScreen.hideAsync();
  }, [auth.ready]);

  useEffect(() => {
    if (!auth.enabled) return;
    if (email && !store.signedIn) dispatch({ type: 'signIn', email });
    if (!auth.session && store.signedIn) dispatch({ type: 'signOut' });
  }, [auth.enabled, auth.session, email, store.signedIn, dispatch]);

  // When you're asked "Are you OK?", take over the screen wherever you are.
  const myChecking = alerts.find((a) => a.forId === 'me' && a.stage === 'checking')?.id;
  useEffect(() => {
    if (myChecking && signedIn && onboarded) router.push('/check-in');
  }, [myChecking, signedIn, onboarded]);

  if (!auth.ready) return null;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="person/[id]" />
          <Stack.Screen name="circle/[id]" />
          <Stack.Screen name="templates" />
          <Stack.Screen name="add-person" options={{ presentation: 'modal' }} />
          <Stack.Screen name="label/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="template-edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="circle-new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="zone/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="alert/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="check-in" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
