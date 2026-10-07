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
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { SosRecorderProvider } from '@/lib/recorder';
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
        <SosRecorderProvider>
          <RootStack />
        </SosRecorderProvider>
      </StoreProvider>
    </AuthProvider>
  );
}

function RootStack() {
  const auth = useAuth();
  const store = useStore();
  const c = useColors();
  const scheme = useColorScheme();

  const signedIn = Boolean(auth.session);
  const ready = auth.ready && (!signedIn || store.loaded);
  const onboarded = store.onboarded;

  useEffect(() => {
    if (auth.ready) SplashScreen.hideAsync();
  }, [auth.ready]);

  // When you're asked "Are you OK?", take over the screen wherever you are.
  const myChecking = store.alerts.find((a) => a.forId === 'me' && a.stage === 'checking')?.id;
  useEffect(() => {
    if (myChecking && signedIn && onboarded) router.push('/check-in');
  }, [myChecking, signedIn, onboarded]);

  if (!auth.ready) return null;
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.beaconText} />
      </View>
    );
  }

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
          <Stack.Screen name="recordings" />
          <Stack.Screen name="history/[id]" />
          <Stack.Screen name="journey/[id]" />
          <Stack.Screen name="journey/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="phone" options={{ presentation: 'modal' }} />
          <Stack.Screen name="recording/[id]" />
          <Stack.Screen name="guardian/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="add-person" options={{ presentation: 'modal' }} />
          <Stack.Screen name="accept/[id]" options={{ presentation: 'modal' }} />
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
