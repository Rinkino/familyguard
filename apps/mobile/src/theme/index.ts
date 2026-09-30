import { useColorScheme } from 'react-native';

const light = {
  bg: '#EEF2F0', // Mist
  surface: '#FFFFFF', // Paper
  ink: '#14231E',
  muted: '#5E7268',
  hairline: '#D6DFDA',
  beacon: '#2F6B4F',
  onBeacon: '#FFFFFF',
  beaconSoft: '#DCE8E1',
  moss: '#9DB5A8',
  flare: '#E4572E',
  flareSoft: '#FBE3DB',
};

const dark: typeof light = {
  bg: '#0E1714',
  surface: '#16221D',
  ink: '#E6EEEA',
  muted: '#8FA69A',
  hairline: '#25332D',
  beacon: '#5FAE86',
  onBeacon: '#0E1714',
  beaconSoft: '#1D3329',
  moss: '#3E5549',
  flare: '#F0714D',
  flareSoft: '#3A1E16',
};

export type Colors = typeof light;

export const fonts = {
  regular: 'SchibstedGrotesk_400Regular',
  medium: 'SchibstedGrotesk_500Medium',
  semibold: 'SchibstedGrotesk_600SemiBold',
  bold: 'SchibstedGrotesk_700Bold',
  heavy: 'SchibstedGrotesk_800ExtraBold',
};

// Modular scale ~1.25 on a 16px base
export const type = {
  display: { fontFamily: fonts.heavy, fontSize: 38, lineHeight: 42, letterSpacing: -1 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19 },
  tiny: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const avatarTints = ['#2F6B4F', '#6B4F2F', '#2F4F6B', '#6B2F4F', '#4F6B2F', '#4F2F6B'];
