import { useColorScheme } from 'react-native';

const light = {
  bg: '#F2F1EC',
  surface: '#FFFFFF',
  ink: '#1C1A14',
  muted: '#6B6758',
  hairline: '#E0DED6',
  /** Accent fill: buttons, toggles, zones, selected chips. */
  beacon: '#F2B705',
  /** Text and icons on a beacon fill. */
  onBeacon: '#2A1F00',
  /** Accent for text, icons and thin lines on light surfaces (readable gold). */
  beaconText: '#8A6400',
  beaconSoft: '#FDF1C7',
  moss: '#C9C2AE',
  flare: '#E4572E',
  flareSoft: '#FBE3DB',
};

const dark: typeof light = {
  bg: '#13120E',
  surface: '#1D1B16',
  ink: '#F0EDE4',
  muted: '#A39E8C',
  hairline: '#2E2B22',
  beacon: '#F2B705',
  onBeacon: '#2A1F00',
  beaconText: '#F2B705',
  beaconSoft: '#3A2F0A',
  moss: '#4A4535',
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

export const avatarTints = ['#8A6400', '#6B4F2F', '#2F4F6B', '#6B2F4F', '#6B3A1F', '#4F2F6B'];
