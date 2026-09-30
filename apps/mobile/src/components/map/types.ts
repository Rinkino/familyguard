import type { StyleProp, ViewStyle } from 'react-native';
import type { LatLng } from '@/lib/geo';

export type MapPerson = { id: string; name: string; tint: number; coord: LatLng; alert?: boolean };
export type MapZone = { id: string; center: LatLng; radiusM: number; alert?: boolean };

export type FamilyMapProps = {
  style?: StyleProp<ViewStyle>;
  /** Where the camera starts, and roughly how many metres to fit around it. */
  initialCenter: LatLng;
  initialSpanM?: number;
  people?: MapPerson[];
  zones?: MapZone[];
  route?: LatLng[];
  pin?: LatLng;
  /** Extra top padding (e.g. under a search bar) when fitting the camera. */
  topInset?: number;
  onLongPress?: (coord: LatLng) => void;
  onPressPerson?: (id: string) => void;
  /** Browser preview only; native circles aren't tappable. Zones are listed in the panel. */
  onPressZone?: (id: string) => void;
  /** Disable panning/zooming, e.g. for small previews. */
  static?: boolean;
};

export type FamilyMapHandle = {
  flyTo: (coord: LatLng, spanM?: number) => void;
  fitTo: (coords: LatLng[]) => void;
};
