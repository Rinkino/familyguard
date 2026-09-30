// Mock data used until the backend exists. Shapes mirror the agreed model:
// each side of a connection owns its own label and its own sharing choice.

import type { LatLng } from '@/lib/geo';

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
  /** What I call this person. Only I see it. */
  label: string;
  templateId?: string;
  /** Do I share my location with them? (my side) */
  iShare: boolean;
  /** Do they share their location with me? (their side, read-only for me) */
  theyShare: boolean;
  status: 'connected' | 'pending';
  place?: string;
  lastSeen?: string;
  /** Last known position, only present when they share with me. */
  coord?: LatLng;
};

/** 'me' or a person id. */
export type Who = 'me' | string;

export type Zone = {
  id: string;
  name: string;
  /** Whose location must stay inside. */
  forId: Who;
  setById: Who;
  center: LatLng;
  radiusM: number;
  /** Epoch ms when the zone switches itself off. null = until turned off. */
  endsAt: number | null;
  /** Minutes to wait after leaving before asking "Are you OK?". */
  graceMin: number;
  /** Seconds the person has to answer before SOS is sent. */
  countdownS: number;
  /** People alerted besides whoever set the zone. */
  watcherIds: Who[];
};

export type AlertStage = 'left' | 'checking' | 'sos' | 'resolved';

export type ZoneAlert = {
  id: string;
  zoneId: string;
  forId: Who;
  stage: AlertStage;
  leftAt: number;
  /** When the current stage ends by itself (grace or countdown). */
  stageEndsAt: number | null;
  sosAt?: number;
  resolvedHow?: 'back-inside' | 'said-ok' | 'marked-safe';
};

export type Circle = {
  id: string;
  name: string;
  memberIds: string[];
  shareWithCircle: boolean;
};

export type Me = {
  name: string;
  email: string;
  tint: number;
  inviteCode: string;
};

export const builtInTemplates: Template[] = [
  { id: 't-parent', name: 'Parent', builtIn: true, shareByDefault: true },
  { id: 't-child', name: 'Child', builtIn: true, shareByDefault: true },
  { id: 't-sibling', name: 'Sibling', builtIn: true, shareByDefault: true },
  { id: 't-partner', name: 'Partner', builtIn: true, shareByDefault: true },
  { id: 't-friend', name: 'Friend', builtIn: true, shareByDefault: false },
];

export const seedCustomTemplates: Template[] = [
  { id: 't-bigbro', name: 'Big bro', builtIn: false, shareByDefault: true },
  { id: 't-roommate', name: 'Roommate', builtIn: false, shareByDefault: false },
];

export const seedPeople: Person[] = [
  {
    id: 'p-ada', name: 'Ada Okafor', tint: 0, label: 'Mum', templateId: 't-parent',
    iShare: true, theyShare: true, status: 'connected', place: 'Home, Surulere', lastSeen: '2 min ago',
    coord: { latitude: 6.4969, longitude: 3.3547 },
  },
  {
    id: 'p-tolu', name: 'Tolu Adeyemi', tint: 1, label: 'Big bro', templateId: 't-bigbro',
    iShare: true, theyShare: false, status: 'connected',
  },
  {
    id: 'p-chioma', name: 'Chioma Eze', tint: 2, label: 'Roommate', templateId: 't-roommate',
    iShare: false, theyShare: true, status: 'connected', place: 'Unilag, Akoka', lastSeen: '12 min ago',
    coord: { latitude: 6.5172, longitude: 3.3869 },
  },
  {
    id: 'p-kunle', name: 'Kunle Bello', tint: 3, label: 'Friend', templateId: 't-friend',
    iShare: false, theyShare: false, status: 'connected',
  },
  {
    id: 'p-zainab', name: 'Zainab Musa', tint: 4, label: 'Friend', templateId: 't-friend',
    iShare: true, theyShare: false, status: 'pending',
  },
];

export const seedCircles: Circle[] = [
  { id: 'c-home', name: 'Home', memberIds: ['p-ada', 'p-tolu'], shareWithCircle: true },
  { id: 'c-uni', name: 'Uni friends', memberIds: ['p-chioma', 'p-kunle'], shareWithCircle: false },
];

/** Where "you" are in the demo: Yaba, Lagos. */
export const myMockCoord: LatLng = { latitude: 6.5095, longitude: 3.3711 };

const HOUR = 3_600_000;

export function seedZones(now = Date.now()): Zone[] {
  return [
    {
      id: 'z-campus', name: 'Campus', forId: 'p-chioma', setById: 'me',
      center: { latitude: 6.5158, longitude: 3.3896 }, radiusM: 1200, endsAt: null,
      graceMin: 10, countdownS: 30, watcherIds: [],
    },
    {
      id: 'z-home', name: 'Around home', forId: 'p-ada', setById: 'me',
      center: { latitude: 6.4969, longitude: 3.3547 }, radiusM: 600, endsAt: now + 3 * HOUR,
      graceMin: 5, countdownS: 30, watcherIds: ['p-tolu'],
    },
    {
      id: 'z-yaba', name: 'Yaba', forId: 'me', setById: 'p-ada',
      center: { latitude: 6.5095, longitude: 3.3711 }, radiusM: 2000, endsAt: now + 5 * HOUR,
      graceMin: 10, countdownS: 20, watcherIds: [],
    },
  ];
}

/** People a mock invite code can resolve to. */
export const discoverablePeople = [
  { name: 'Emeka Nwosu', tint: 5 },
  { name: 'Funke Ajayi', tint: 2 },
  { name: 'Ibrahim Sani', tint: 3 },
];
