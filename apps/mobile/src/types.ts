import type { LatLng } from '@/lib/geo';

/** 'me' for the signed-in user, otherwise a user id. */
export type Who = 'me' | string;

export type Template = {
  id: string;
  name: string;
  builtIn: boolean;
  shareByDefault: boolean;
};

export type Person = {
  id: string;
  name: string;
  tint: number;
  /** What I call this person. Only I see it. Empty for incoming requests. */
  label: string;
  templateId?: string;
  /** Do I share my location with them? (my side) */
  iShare: boolean;
  /** Can I see their location right now? */
  theyShare: boolean;
  /** connected: both sides added. pending: I asked. incoming: they asked. */
  status: 'connected' | 'pending' | 'incoming';
  coord?: LatLng;
  locationAt?: number;
  /** Parent/child agreement with this person, if any. */
  guardianship?: Guardianship;
};

export type Guardianship = {
  /** true: I'm their guardian. false: they're my guardian. */
  iAmGuardian: boolean;
  status: 'proposed' | 'active' | 'release_requested';
  proposedByMe: boolean;
};

export type Circle = {
  id: string;
  name: string;
  memberIds: string[];
  shareWithCircle: boolean;
};

export type Me = {
  id: string;
  name: string;
  email: string;
  tint: number;
  inviteCode: string;
};

export type Zone = {
  id: string;
  name: string;
  forId: Who;
  setById: Who;
  center: LatLng;
  radiusM: number;
  /** Epoch ms when the zone switches itself off. null = until turned off. */
  endsAt: number | null;
  graceMin: number;
  countdownS: number;
  watcherIds: Who[];
};

export type AlertStage = 'left' | 'checking' | 'sos' | 'resolved';

export type ZoneAlert = {
  id: string;
  kind: 'zone' | 'manual' | 'silence';
  zoneId: string | null;
  zoneName: string | null;
  forId: Who;
  watcherIds: Who[];
  stage: AlertStage;
  countdownS: number;
  leftAt: number;
  stageEndsAt: number | null;
  sosAt?: number;
  resolvedHow?: 'back-inside' | 'said-ok' | 'marked-safe' | 'back-online';
  coord?: LatLng;
  /** Name given to this SOS in the recordings library. */
  title?: string;
};
