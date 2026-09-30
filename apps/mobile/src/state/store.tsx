import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/lib/auth';
import { distanceMeters, type LatLng } from '@/lib/geo';
import { supabase } from '@/lib/supabase';
import type { Circle, Me, Person, Template, Who, Zone, ZoneAlert } from '@/types';

/** Used for map centring until the first GPS fix: Yaba, Lagos. */
const FALLBACK_COORD: LatLng = { latitude: 6.5095, longitude: 3.3711 };

const SEND_EVERY_MS = 15_000;
const SEND_EVERY_MS_SOS = 5_000;
const SEND_MIN_MOVE_M = 25;
const REFRESH_EVERY_MS = 20_000;

type Data = {
  loaded: boolean;
  me: Me;
  onboarded: boolean;
  pausedAll: boolean;
  templates: Template[];
  people: Person[];
  circles: Circle[];
  zones: Zone[];
  alerts: ZoneAlert[];
};

const empty: Data = {
  loaded: false,
  me: { id: '', name: '', email: '', tint: 0, inviteCode: '' },
  onboarded: false,
  pausedAll: false,
  templates: [],
  people: [],
  circles: [],
  zones: [],
  alerts: [],
};

type LocationState = {
  myCoord: LatLng;
  hasFix: boolean;
  permission: 'unknown' | 'granted' | 'denied';
};

function need<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function loadData(userId: string, email: string): Promise<Data> {
  const db = supabase!;
  const toWho = (id: string): Who => (id === userId ? 'me' : id);

  const [profile, templates, people, circles, members, zones, alerts] = await Promise.all([
    db.from('profiles').select('display_name, tint, invite_code, sharing_paused').eq('id', userId).single(),
    db.from('relationship_templates').select('id, owner_id, name, share_by_default').order('created_at'),
    db.rpc('my_people'),
    db.from('circles').select('id, name, share_with_circle').order('created_at'),
    db.from('circle_members').select('circle_id, member_id'),
    db.from('zones').select('*').eq('active', true).order('created_at'),
    db
      .from('alerts')
      .select('*')
      .or(`stage.neq.resolved,resolved_at.gt.${new Date(Date.now() - 6 * 3600_000).toISOString()}`)
      .order('left_at', { ascending: false }),
  ]);

  const p = need(profile);
  if (!p) throw new Error('Profile missing. Has the database migration been run?');
  const memberRows = need(members) ?? [];

  return {
    loaded: true,
    me: { id: userId, email, name: p.display_name ?? '', tint: p.tint, inviteCode: p.invite_code },
    onboarded: Boolean(p.display_name),
    pausedAll: p.sharing_paused,
    templates: (need(templates) ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      builtIn: t.owner_id === null,
      shareByDefault: t.share_by_default,
    })),
    people: ((need(people) ?? []) as any[])
      .map((r) => ({
        id: r.id as string,
        name: (r.display_name as string) ?? 'New user',
        tint: r.tint ?? 0,
        label: r.label ?? '',
        templateId: r.template_id ?? undefined,
        iShare: Boolean(r.i_share),
        theyShare: Boolean(r.they_share),
        status: r.status as Person['status'],
        coord: r.lat != null ? { latitude: r.lat, longitude: r.lng } : undefined,
        locationAt: r.location_at ? Date.parse(r.location_at) : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    circles: (need(circles) ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      shareWithCircle: c.share_with_circle,
      memberIds: memberRows.filter((m) => m.circle_id === c.id).map((m) => m.member_id),
    })),
    zones: (need(zones) ?? []).map((z) => ({
      id: z.id,
      name: z.name,
      forId: toWho(z.for_user),
      setById: toWho(z.created_by),
      center: { latitude: z.center_lat, longitude: z.center_lng },
      radiusM: z.radius_m,
      endsAt: z.ends_at ? Date.parse(z.ends_at) : null,
      graceMin: z.grace_min,
      countdownS: z.countdown_s,
      watcherIds: (z.watcher_ids as string[]).map(toWho),
    })),
    alerts: (need(alerts) ?? []).map((a) => ({
      id: a.id,
      kind: a.kind,
      zoneId: a.zone_id,
      zoneName: a.zone_name,
      forId: toWho(a.for_user),
      watcherIds: (a.watcher_ids as string[]).map(toWho),
      stage: a.stage,
      countdownS: a.countdown_s,
      leftAt: Date.parse(a.left_at),
      stageEndsAt: a.stage_ends_at ? Date.parse(a.stage_ends_at) : null,
      sosAt: a.sos_at ? Date.parse(a.sos_at) : undefined,
      resolvedHow: a.resolved_how ?? undefined,
      coord: a.lat != null ? { latitude: a.lat, longitude: a.lng } : undefined,
    })),
  };
}

export type ZoneInput = Omit<Zone, 'id' | 'setById'> & { id?: string };

function useActions(data: Data, loc: LocationState, reload: () => Promise<void>, pretend: (c: LatLng) => Promise<void>) {
  const db = supabase!;
  const myId = data.me.id;
  const fromWho = (w: Who) => (w === 'me' ? myId : w);

  const run = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => {
    const res = await p;
    if (res.error) throw new Error(res.error.message);
    await reload();
    return res.data;
  };

  return {
    saveProfile: (name: string, tint: number) =>
      run(db.from('profiles').update({ display_name: name, tint }).eq('id', myId)),
    setPausedAll: (value: boolean) => run(db.from('profiles').update({ sharing_paused: value }).eq('id', myId)),

    setShare: (personId: string, value: boolean) =>
      run(db.from('connections').update({ shares_location: value }).eq('owner_id', myId).eq('other_id', personId)),
    setLabel: (personId: string, label: string, templateId?: string) =>
      run(
        db.from('connections').update({ label, template_id: templateId ?? null }).eq('owner_id', myId).eq('other_id', personId)
      ),
    removePerson: (personId: string) => run(db.rpc('remove_person', { other: personId })),

    previewCode: async (code: string) => {
      const { data: rows, error } = await db.rpc('preview_invite_code', { code });
      if (error) throw new Error(error.message);
      const row = (rows as any[])?.[0];
      return row ? { id: row.id as string, name: (row.display_name as string) ?? 'New user', tint: row.tint as number } : null;
    },
    connect: (code: string, label: string, templateId: string | undefined, share: boolean) =>
      run(db.rpc('connect_with_code', { code, label, template: templateId ?? null, share })),
    accept: (otherId: string, label: string, templateId: string | undefined, share: boolean) =>
      run(db.rpc('accept_request', { other: otherId, label, template: templateId ?? null, share })),

    saveTemplate: async (t: { id?: string; name: string; shareByDefault: boolean }) => {
      if (!t.id) {
        return run(db.from('relationship_templates').insert({ owner_id: myId, name: t.name, share_by_default: t.shareByDefault }));
      }
      need(await db.from('relationship_templates').update({ name: t.name, share_by_default: t.shareByDefault }).eq('id', t.id));
      // Renaming a label renames it for everyone you've given it to.
      return run(db.from('connections').update({ label: t.name }).eq('owner_id', myId).eq('template_id', t.id));
    },
    deleteTemplate: (id: string) => run(db.from('relationship_templates').delete().eq('id', id)),

    saveCircle: async (c: { id?: string; name: string; shareWithCircle: boolean }) => {
      if (c.id) {
        await run(db.from('circles').update({ name: c.name, share_with_circle: c.shareWithCircle }).eq('id', c.id));
        return c.id;
      }
      const row = await run(
        db.from('circles').insert({ owner_id: myId, name: c.name, share_with_circle: c.shareWithCircle }).select('id').single()
      );
      return (row as { id: string }).id;
    },
    deleteCircle: (id: string) => run(db.from('circles').delete().eq('id', id)),
    toggleCircleMember: (circleId: string, personId: string) => {
      const inCircle = data.circles.find((c) => c.id === circleId)?.memberIds.includes(personId);
      return inCircle
        ? run(db.from('circle_members').delete().eq('circle_id', circleId).eq('member_id', personId))
        : run(db.from('circle_members').insert({ circle_id: circleId, member_id: personId }));
    },

    saveZone: (z: ZoneInput) => {
      const row = {
        name: z.name,
        for_user: fromWho(z.forId),
        center_lat: z.center.latitude,
        center_lng: z.center.longitude,
        radius_m: z.radiusM,
        ends_at: z.endsAt ? new Date(z.endsAt).toISOString() : null,
        grace_min: z.graceMin,
        countdown_s: z.countdownS,
        watcher_ids: z.watcherIds.map(fromWho).filter((w) => w !== fromWho(z.forId)),
      };
      return z.id
        ? run(db.from('zones').update(row).eq('id', z.id))
        : run(db.from('zones').insert({ ...row, created_by: myId }));
    },
    endZone: (id: string) => run(db.from('zones').update({ active: false }).eq('id', id)),

    answerOk: (alertId: string) => run(db.rpc('answer_ok', { alert: alertId })),
    markSafe: (alertId: string) => run(db.rpc('mark_safe', { alert: alertId })),
    sosNow: (alertId: string | null) =>
      run(db.rpc('sos_now', { alert: alertId, lat: loc.myCoord.latitude, lng: loc.myCoord.longitude })) as Promise<string>,
    advance: () => run(db.rpc('advance_alerts')),

    /** Testing only: report a position outside a zone and hold it for 3 minutes. */
    pretendLeave: (zone: Zone) => {
      const outside = {
        latitude: zone.center.latitude + ((zone.radiusM + 300) / 111_320),
        longitude: zone.center.longitude,
      };
      return pretend(outside);
    },
  };
}

type Store = Data &
  LocationState & {
    refresh: () => Promise<void>;
    actions: ReturnType<typeof useActions>;
  };

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const email = session?.user.email ?? '';
  const [data, setData] = useState<Data>(empty);
  const [loc, setLoc] = useState<LocationState>({ myCoord: FALLBACK_COORD, hasFix: false, permission: 'unknown' });

  const reload = useCallback(async () => {
    if (!userId || !supabase) return;
    try {
      setData(await loadData(userId, email));
    } catch (e) {
      console.warn('Failed to load data', e);
    }
  }, [userId, email]);

  // Initial load, periodic refresh, refresh on foreground, and live changes.
  useEffect(() => {
    if (!userId || !supabase) {
      setData(empty);
      return;
    }
    reload();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(reload, 300);
    };
    const channel = supabase
      .channel(`app-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_locations' }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, soon)
      .subscribe();
    const interval = setInterval(reload, REFRESH_EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && reload());
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      sub.remove();
      supabase?.removeChannel(channel);
    };
  }, [userId, reload]);

  // Location sharing while the app is open.
  const lastSent = useRef<{ at: number; coord: LatLng } | null>(null);
  const holdUntil = useRef(0);
  const inSos = data.alerts.some((a) => a.forId === 'me' && a.stage === 'sos');

  const send = useCallback(
    async (coord: LatLng, accuracy: number | null, force = false) => {
      if (!userId || !supabase) return;
      const now = Date.now();
      const last = lastSent.current;
      const every = inSos ? SEND_EVERY_MS_SOS : SEND_EVERY_MS;
      if (!force && last && now - last.at < every && distanceMeters(last.coord, coord) < SEND_MIN_MOVE_M) return;
      lastSent.current = { at: now, coord };
      const { error } = await supabase.from('user_locations').upsert({
        user_id: userId,
        lat: coord.latitude,
        lng: coord.longitude,
        accuracy_m: accuracy,
        updated_at: new Date().toISOString(),
      });
      if (error) console.warn('Location upload failed', error.message);
    },
    [userId, inSos]
  );

  useEffect(() => {
    if (!userId || !data.onboarded) return;
    let watcher: Location.LocationSubscription | undefined;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setLoc((l) => ({ ...l, permission: 'denied' }));
        return;
      }
      setLoc((l) => ({ ...l, permission: 'granted' }));
      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: SEND_EVERY_MS_SOS, distanceInterval: 10 },
        (pos) => {
          const coord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          if (Date.now() < holdUntil.current) return; // a test position is being held
          setLoc((l) => ({ ...l, myCoord: coord, hasFix: true }));
          send(coord, pos.coords.accuracy ?? null);
        }
      );
    })();
    return () => {
      cancelled = true;
      watcher?.remove();
    };
  }, [userId, data.onboarded, send]);

  const pretend = useCallback(
    async (coord: LatLng) => {
      holdUntil.current = Date.now() + 3 * 60_000;
      setLoc((l) => ({ ...l, myCoord: coord }));
      await send(coord, null, true);
      await reload();
    },
    [send, reload]
  );

  const actions = useActions(data, loc, reload, pretend);
  const value = useMemo(() => ({ ...data, ...loc, refresh: reload, actions }), [data, loc, reload, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

/** Circles of mine that share my location with this person. */
export function sharingCircles(circles: Circle[], personId: string): Circle[] {
  return circles.filter((c) => c.shareWithCircle && c.memberIds.includes(personId));
}

/** Whether this person can actually see me, after circles and the global pause. */
export function effectiveShare(state: Pick<Store, 'circles' | 'pausedAll'>, person: Person): boolean {
  if (state.pausedAll || person.status !== 'connected') return false;
  return person.iShare || sharingCircles(state.circles, person.id).length > 0;
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

export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
