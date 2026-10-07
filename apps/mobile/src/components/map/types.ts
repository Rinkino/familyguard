import type { StyleProp, ViewStyle } from 'react-native';
import type { LatLng } from '@/lib/geo';

export type MapPerson = { id: string; name: string; tint: number; coord: LatLng; alert?: boolean; /** Shown faded: no recent location. */ stale?: boolean };
export type MapMarker = { id: string; coord: LatLng; kind: 'destination' | 'roadblock'; title?: string };
export type MapZone = { id: string; center: LatLng; radiusM: number; alert?: boolean };

export type FamilyMapProps = {
  style?: StyleProp<ViewStyle>;
  /** Where the camera starts, and roughly how many metres to fit around it. */
  initialCenter: LatLng;
  initialSpanM?: number;
  people?: MapPerson[];
  zones?: MapZone[];
  route?: LatLng[];
  /** More routes to draw, e.g. journeys you're watching. */
  routes?: { id: string; coords: LatLng[]; muted?: boolean }[];
  /** Destinations and user-reported roadblocks. */
  markers?: MapMarker[];
  pin?: LatLng;
  /** Extra top padding (e.g. under a search bar) when fitting the camera. */
  topInset?: number;
  /** Space covered at the bottom (e.g. by a sheet) to keep clear when fitting. */
  bottomInset?: number;
  onLongPress?: (coord: LatLng) => void;
  /** Fires when the user starts moving the map. */
  onPanDrag?: () => void;
  onPressPerson?: (id: string) => void;
  /** Browser preview only; native circles aren't tappable. Zones are listed in the panel. */
  onPressZone?: (id: string) => void;
  /** Disable panning/zooming, e.g. for small previews. */
  static?: boolean;
};

export type FamilyMapHandle = {
  flyTo: (coord: LatLng, spanM?: number) => void;
  fitTo: (coords: LatLng[]) => void;
  /** Frame a circle so it fills the width, with `margin` x its radius around it. */
  fitCircle: (center: LatLng, radiusM: number, margin?: number) => void;
};
