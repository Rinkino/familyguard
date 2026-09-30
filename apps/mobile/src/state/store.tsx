import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { offset, type LatLng } from '@/lib/geo';
import {
  builtInTemplates,
  discoverablePeople,
  myMockCoord,
  seedCircles,
  seedCustomTemplates,
  seedPeople,
  seedZones,
  type Circle,
  type Me,
  type Person,
  type Template,
  type Who,
  type Zone,
  type ZoneAlert,
} from '@/mock/data';

/** Demo speeds timers up: one "minute" of grace passes in one second. */
export const DEMO_MINUTE_MS = 1000;

type State = {
  signedIn: boolean;
  onboarded: boolean;
  me: Me;
  myCoord: LatLng;
  pausedAll: boolean;
  templates: Template[];
  people: Person[];
  circles: Circle[];
  zones: Zone[];
  alerts: ZoneAlert[];
};

type Action =
  | { type: 'signIn'; email: string }
  | { type: 'signOut' }
  | { type: 'finishOnboarding'; name: string; tint: number }
  | { type: 'setPausedAll'; value: boolean }
  | { type: 'setShare'; personId: string; value: boolean }
  | { type: 'setLabel'; personId: string; label: string; templateId?: string }
  | { type: 'removePerson'; personId: string }
  | { type: 'addPending'; person: Person }
  | { type: 'saveTemplate'; template: Template }
  | { type: 'deleteTemplate'; templateId: string }
  | { type: 'saveCircle'; circle: Circle }
  | { type: 'deleteCircle'; circleId: string }
  | { type: 'toggleCircleMember'; circleId: string; personId: string }
  | { type: 'saveZone'; zone: Zone }
  | { type: 'endZone'; zoneId: string }
  | { type: 'simulateLeave'; zoneId: string; now: number }
  | { type: 'backInside'; alertId: string }
  | { type: 'sayOk'; alertId: string }
  | { type: 'sosNow'; alertId: string; now: number }
  | { type: 'markSafe'; alertId: string }
  | { type: 'dismissAlert'; alertId: string }
  | { type: 'tick'; now: number }
  | { type: 'reset' };

const seedData = () => ({
  myCoord: myMockCoord,
  pausedAll: false,
  templates: [...builtInTemplates, ...seedCustomTemplates],
  people: seedPeople,
  circles: seedCircles,
  zones: seedZones(),
  alerts: [] as ZoneAlert[],
});

const initial: State = {
  signedIn: false,
  onboarded: false,
  me: { name: '', email: '', tint: 0, inviteCode: 'KX7-42P' },
  ...seedData(),
};

function updatePerson(state: State, id: string, patch: Partial<Person>): State {
  return { ...state, people: state.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

function moveWho(state: State, who: Who, coord: LatLng): State {
  return who === 'me' ? { ...state, myCoord: coord } : updatePerson(state, who, { coord, lastSeen: 'just now' });
}

function updateAlert(state: State, id: string, patch: Partial<ZoneAlert>): State {
  return { ...state, alerts: state.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
}

function advance(state: State, now: number): State {
  let changed = false;
  const alerts = state.alerts.map((a) => {
    if (a.stageEndsAt === null || now < a.stageEndsAt) return a;
    const zone = state.zones.find((z) => z.id === a.zoneId);
    changed = true;
    if (a.stage === 'left') {
      return { ...a, stage: 'checking' as const, stageEndsAt: now + (zone?.countdownS ?? 30) * 1000 };
    }
    return { ...a, stage: 'sos' as const, stageEndsAt: null, sosAt: now };
  });
  const zones = state.zones.filter((z) => z.endsAt === null || z.endsAt > now);
  if (zones.length !== state.zones.length) changed = true;
  return changed ? { ...state, alerts, zones } : state;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'signIn':
      return { ...state, signedIn: true, me: { ...state.me, email: action.email } };
    case 'signOut':
      return { ...initial };
    case 'finishOnboarding':
      return { ...state, onboarded: true, me: { ...state.me, name: action.name, tint: action.tint } };
    case 'setPausedAll':
      return { ...state, pausedAll: action.value };
    case 'setShare':
      return updatePerson(state, action.personId, { iShare: action.value });
    case 'setLabel':
      return updatePerson(state, action.personId, { label: action.label, templateId: action.templateId });
    case 'removePerson':
      return {
        ...state,
        people: state.people.filter((p) => p.id !== action.personId),
        circles: state.circles.map((c) => ({ ...c, memberIds: c.memberIds.filter((m) => m !== action.personId) })),
      };
    case 'addPending':
      return { ...state, people: [action.person, ...state.people] };
    case 'saveTemplate': {
      const exists = state.templates.some((t) => t.id === action.template.id);
      const templates = exists
        ? state.templates.map((t) => (t.id === action.template.id ? action.template : t))
        : [...state.templates, action.template];
      // Keep labels in sync when a template is renamed
      const people = state.people.map((p) =>
        p.templateId === action.template.id ? { ...p, label: action.template.name } : p
      );
      return { ...state, templates, people };
    }
    case 'deleteTemplate':
      return {
        ...state,
        templates: state.templates.filter((t) => t.id !== action.templateId),
        // People keep their label text; it just becomes a custom label
        people: state.people.map((p) => (p.templateId === action.templateId ? { ...p, templateId: undefined } : p)),
      };
    case 'saveCircle': {
      const exists = state.circles.some((c) => c.id === action.circle.id);
      return {
        ...state,
        circles: exists
          ? state.circles.map((c) => (c.id === action.circle.id ? action.circle : c))
          : [...state.circles, action.circle],
      };
    }
    case 'deleteCircle':
      return { ...state, circles: state.circles.filter((c) => c.id !== action.circleId) };
    case 'toggleCircleMember':
      return {
        ...state,
        circles: state.circles.map((c) => {
          if (c.id !== action.circleId) return c;
          const has = c.memberIds.includes(action.personId);
          return {
            ...c,
            memberIds: has ? c.memberIds.filter((m) => m !== action.personId) : [...c.memberIds, action.personId],
          };
        }),
      };
    case 'saveZone': {
      const exists = state.zones.some((z) => z.id === action.zone.id);
      return {
        ...state,
        zones: exists ? state.zones.map((z) => (z.id === action.zone.id ? action.zone : z)) : [...state.zones, action.zone],
      };
    }
    case 'endZone':
      return {
        ...state,
        zones: state.zones.filter((z) => z.id !== action.zoneId),
        alerts: state.alerts.filter((a) => a.zoneId !== action.zoneId),
      };
    case 'simulateLeave': {
      const zone = state.zones.find((z) => z.id === action.zoneId);
      if (!zone || state.alerts.some((a) => a.zoneId === zone.id && a.stage !== 'resolved')) return state;
      const moved = moveWho(state, zone.forId, offset(zone.center, zone.radiusM + 350, 60));
      const alert: ZoneAlert = {
        id: `a-${action.now}`,
        zoneId: zone.id,
        forId: zone.forId,
        stage: 'left',
        leftAt: action.now,
        stageEndsAt: action.now + zone.graceMin * DEMO_MINUTE_MS,
      };
      return { ...moved, alerts: [alert, ...state.alerts.filter((a) => a.zoneId !== zone.id)] };
    }
    case 'backInside': {
      const alert = state.alerts.find((a) => a.id === action.alertId);
      const zone = state.zones.find((z) => z.id === alert?.zoneId);
      if (!alert || !zone) return state;
      const moved = moveWho(state, zone.forId, offset(zone.center, zone.radiusM * 0.3, 200));
      return updateAlert(moved, alert.id, { stage: 'resolved', stageEndsAt: null, resolvedHow: 'back-inside' });
    }
    case 'sayOk':
      return updateAlert(state, action.alertId, { stage: 'resolved', stageEndsAt: null, resolvedHow: 'said-ok' });
    case 'sosNow':
      return updateAlert(state, action.alertId, { stage: 'sos', stageEndsAt: null, sosAt: action.now });
    case 'markSafe':
      return updateAlert(state, action.alertId, { stage: 'resolved', stageEndsAt: null, resolvedHow: 'marked-safe' });
    case 'dismissAlert':
      return { ...state, alerts: state.alerts.filter((a) => a.id !== action.alertId) };
    case 'tick':
      return advance(state, action.now);
    case 'reset':
      return { ...state, ...seedData() };
  }
}

type Store = State & { dispatch: React.Dispatch<Action> };

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const value = useMemo(() => ({ ...state, dispatch }), [state]);

  // Drives alert stages and zone expiry. The reducer returns the same state
  // when nothing changed, so idle ticks don't re-render.
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 1000);
    return () => clearInterval(id);
  }, []);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

/** Circles that share my location with this person. */
export function sharingCircles(circles: Circle[], personId: string): Circle[] {
  return circles.filter((c) => c.shareWithCircle && c.memberIds.includes(personId));
}

/** Whether this person can actually see me, after circles and the global pause. */
export function effectiveShare(state: Pick<State, 'circles' | 'pausedAll'>, person: Person): boolean {
  if (state.pausedAll || person.status !== 'connected') return false;
  return person.iShare || sharingCircles(state.circles, person.id).length > 0;
}

/** Mock lookup for an invite code. Any code of 6+ characters finds someone. */
export function lookupInviteCode(code: string) {
  const clean = code.replace(/[^a-z0-9]/gi, '');
  if (clean.length < 6) return null;
  const sum = [...clean].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  return discoverablePeople[sum % discoverablePeople.length];
}

export function firstName(name: string) {
  return name.split(' ')[0];
}

/** Display name for 'me' or a person id, from the viewer's side. */
export function whoName(people: Person[], who: Who, you = 'You'): string {
  if (who === 'me') return you;
  const p = people.find((x) => x.id === who);
  return p ? firstName(p.name) : 'Someone';
}

/** Zones can be set for yourself or anyone who shares their location with you. */
export function zoneTargets(people: Person[]): Person[] {
  return people.filter((p) => p.status === 'connected' && p.theyShare);
}

export function activeAlerts(alerts: ZoneAlert[]) {
  return alerts.filter((a) => a.stage !== 'resolved');
}

/** Re-renders every second while mounted; for countdowns. */
export function useNow(): number {
  const [now, setNow] = useReducer((_: number, n: number) => n, Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `0:${String(s).padStart(2, '0')}`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m}:${String(s % 60).padStart(2, '0')}`;
}
