import type { Session } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

// In Expo Go this is exp://<your-ip>:<port>/--/ ; in a build it's familyguard://
export const redirectTo = makeRedirectUri();

type Auth = {
  /** False when Supabase isn't configured: sign-in is simulated. */
  enabled: boolean;
  ready: boolean;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

/** Turns the tokens in a redirect URL (OAuth or magic link) into a session. */
async function sessionFromUrl(url: string) {
  if (!supabase) return;
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode || params.error_description) throw new Error(params.error_description ?? errorCode ?? 'Sign-in failed');
  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const incomingUrl = Linking.useLinkingURL();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Magic links open the app with tokens in the URL.
  useEffect(() => {
    if (incomingUrl) sessionFromUrl(incomingUrl).catch(() => {});
  }, [incomingUrl]);

  const value: Auth = {
    enabled: Boolean(supabase),
    ready,
    session,
    signInWithGoogle: async () => {
      if (!supabase) return;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      const res = await WebBrowser.openAuthSessionAsync(data.url ?? '', redirectTo);
      if (res.type === 'success') await sessionFromUrl(res.url);
    },
    sendMagicLink: async (email) => {
      if (!supabase) return;
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
    },
    signOut: async () => {
      await supabase?.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}

/** Best-effort display name from the Google profile. */
export function nameFromSession(session: Session | null): string {
  const meta = session?.user.user_metadata ?? {};
  return (meta.full_name ?? meta.name ?? '') as string;
}
