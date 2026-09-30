-- FamilyGuard core schema.
-- Paste into Supabase > SQL Editor and run once.
--
-- Privacy model: every table has row-level security. People only see
--   * their own rows,
--   * the location of someone who shares with them (directly, via a circle,
--     or because that person has an active SOS that includes them),
--   * zones and alerts they are part of.
-- Labels are private to their owner; the other person never sees them.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  tint smallint not null default 0,
  invite_code text not null unique,
  sharing_paused boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.new_invite_code() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    code := substr(code, 1, 3) || '-' || substr(code, 4, 3);
    exit when not exists (select 1 from public.profiles where invite_code = code);
  end loop;
  return code;
end $$;

-- Every new auth user gets a profile with an invite code.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, invite_code)
  values (new.id, null, public.new_invite_code());
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users who signed up before this migration.
insert into public.profiles (id, invite_code)
select id, public.new_invite_code() from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Label templates (built-in rows have owner_id null)
-- ---------------------------------------------------------------------------

create table public.relationship_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  share_by_default boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.relationship_templates (owner_id, name, share_by_default) values
  (null, 'Parent', true), (null, 'Child', true), (null, 'Sibling', true),
  (null, 'Partner', true), (null, 'Friend', false);

-- ---------------------------------------------------------------------------
-- Connections: one row per direction. A pair is connected when both rows
-- exist. Each row is the owner's private view of the other person.
-- ---------------------------------------------------------------------------

create table public.connections (
  owner_id uuid not null references auth.users (id) on delete cascade,
  other_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 40),
  template_id uuid references public.relationship_templates (id) on delete set null,
  shares_location boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (owner_id, other_id),
  check (owner_id <> other_id)
);
create index connections_other_idx on public.connections (other_id);

create or replace function public.is_connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from connections where owner_id = a and other_id = b)
     and exists (select 1 from connections where owner_id = b and other_id = a);
$$;

-- ---------------------------------------------------------------------------
-- Circles: private groups owned by one user
-- ---------------------------------------------------------------------------

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  share_with_circle boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  member_id uuid not null references auth.users (id) on delete cascade,
  primary key (circle_id, member_id)
);

-- ---------------------------------------------------------------------------
-- Zones and alerts
-- ---------------------------------------------------------------------------

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  for_user uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m integer not null check (radius_m between 50 and 20000),
  ends_at timestamptz,              -- null = until turned off
  grace_min integer not null default 10 check (grace_min between 0 and 120),
  countdown_s integer not null default 30 check (countdown_s between 10 and 300),
  watcher_ids uuid[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index zones_for_user_idx on public.zones (for_user) where active;

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('zone', 'manual')),
  zone_id uuid references public.zones (id) on delete set null,
  zone_name text,
  for_user uuid not null references auth.users (id) on delete cascade,
  watcher_ids uuid[] not null,
  stage text not null check (stage in ('left', 'checking', 'sos', 'resolved')),
  countdown_s integer not null default 30,
  left_at timestamptz not null default now(),
  stage_ends_at timestamptz,
  sos_at timestamptz,
  resolved_at timestamptz,
  resolved_how text check (resolved_how in ('back-inside', 'said-ok', 'marked-safe')),
  lat double precision,
  lng double precision
);
create index alerts_open_idx on public.alerts (for_user) where stage <> 'resolved';

-- ---------------------------------------------------------------------------
-- Latest location per user
-- ---------------------------------------------------------------------------

create table public.user_locations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  updated_at timestamptz not null default now()
);

-- Who may see target's location right now.
create or replace function public.can_see_location(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
    or exists (
      select 1 from alerts a
      where a.for_user = target and a.stage = 'sos' and auth.uid() = any (a.watcher_ids)
    )
    or (
      public.is_connected(target, auth.uid())
      and not coalesce((select sharing_paused from profiles where id = target), false)
      and (
        exists (select 1 from connections c
                where c.owner_id = target and c.other_id = auth.uid() and c.shares_location)
        or exists (select 1 from circles ci join circle_members m on m.circle_id = ci.id
                   where ci.owner_id = target and ci.share_with_circle and m.member_id = auth.uid())
      )
    );
$$;

create or replace function public.distance_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Zone checks run on the server whenever a location arrives, so every
-- watcher sees the same state.
create or replace function public.check_zones() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  z record;
  open_alert record;
  outside boolean;
begin
  for z in
    select * from zones
    where for_user = new.user_id and active and (ends_at is null or ends_at > now())
  loop
    outside := public.distance_m(new.lat, new.lng, z.center_lat, z.center_lng) > z.radius_m;
    select * into open_alert from alerts
      where zone_id = z.id and stage <> 'resolved' order by left_at desc limit 1;

    if outside and open_alert.id is null then
      insert into alerts (kind, zone_id, zone_name, for_user, watcher_ids, stage,
                          countdown_s, stage_ends_at, lat, lng)
      values ('zone', z.id, z.name, z.for_user,
              array(select distinct w from unnest(z.watcher_ids || z.created_by) w where w <> z.for_user),
              'left', z.countdown_s, now() + make_interval(mins => z.grace_min), new.lat, new.lng);
    elsif not outside and open_alert.id is not null and open_alert.stage in ('left', 'checking') then
      update alerts set stage = 'resolved', resolved_how = 'back-inside',
                        resolved_at = now(), stage_ends_at = null
      where id = open_alert.id;
    elsif open_alert.id is not null then
      update alerts set lat = new.lat, lng = new.lng where id = open_alert.id;
    end if;
  end loop;

  -- Keep manual SOS alerts pointing at the latest position too.
  update alerts set lat = new.lat, lng = new.lng
  where for_user = new.user_id and kind = 'manual' and stage = 'sos';
  return new;
end $$;

create trigger user_locations_check_zones
  after insert or update on public.user_locations
  for each row execute function public.check_zones();

-- Moves alerts through their stages and switches off expired zones.
-- Runs every 10 seconds via pg_cron; clients may also call it (idempotent).
create or replace function public.advance_alerts() returns void
language plpgsql security definer set search_path = public as $$
begin
  update alerts set stage = 'checking', stage_ends_at = now() + make_interval(secs => countdown_s)
  where stage = 'left' and stage_ends_at <= now();

  update alerts set stage = 'sos', sos_at = now(), stage_ends_at = null
  where stage = 'checking' and stage_ends_at <= now();

  update zones set active = false where active and ends_at is not null and ends_at <= now();
end $$;

select cron.schedule('advance-alerts', '10 seconds', 'select public.advance_alerts()');

-- ---------------------------------------------------------------------------
-- SOS recordings (audio chunks in the private "sos-recordings" bucket)
-- ---------------------------------------------------------------------------

create table public.sos_recordings (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create or replace function public.can_see_alert(alert uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from alerts a
                 where a.id = alert and (a.for_user = auth.uid() or auth.uid() = any (a.watcher_ids)));
$$;

insert into storage.buckets (id, name, public) values ('sos-recordings', 'sos-recordings', false)
on conflict (id) do nothing;

create policy "Upload own SOS audio" on storage.objects for insert to authenticated
with check (
  bucket_id = 'sos-recordings'
  and exists (select 1 from public.alerts a
              where a.id::text = (storage.foldername(name))[1] and a.for_user = auth.uid())
);

create policy "Watchers can listen to SOS audio" on storage.objects for select to authenticated
using (
  bucket_id = 'sos-recordings'
  and public.can_see_alert(((storage.foldername(name))[1])::uuid)
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.relationship_templates enable row level security;
alter table public.connections enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.zones enable row level security;
alter table public.alerts enable row level security;
alter table public.user_locations enable row level security;
alter table public.sos_recordings enable row level security;

-- Profiles: yourself, and anyone you have a connection row with (either way).
create policy "Read own and connected profiles" on public.profiles for select to authenticated
using (
  id = auth.uid()
  or exists (select 1 from connections c
             where (c.owner_id = auth.uid() and c.other_id = profiles.id)
                or (c.other_id = auth.uid() and c.owner_id = profiles.id))
);
create policy "Update own profile" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy "Read built-in and own templates" on public.relationship_templates for select to authenticated
using (owner_id is null or owner_id = auth.uid());
create policy "Manage own templates" on public.relationship_templates for all to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Connections: only your own side. Creating and removing go through functions.
create policy "Read own connection rows" on public.connections for select to authenticated
using (owner_id = auth.uid());
create policy "Edit own connection rows" on public.connections for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Manage own circles" on public.circles for all to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Manage members of own circles" on public.circle_members for all to authenticated
using (exists (select 1 from circles c where c.id = circle_id and c.owner_id = auth.uid()))
with check (exists (select 1 from circles c where c.id = circle_id and c.owner_id = auth.uid()));

-- Zones: creator, the person inside, and watchers can see them.
create policy "Read zones you are part of" on public.zones for select to authenticated
using (created_by = auth.uid() or for_user = auth.uid() or auth.uid() = any (watcher_ids));
create policy "Create zones for yourself or people sharing with you" on public.zones for insert to authenticated
with check (created_by = auth.uid() and (for_user = auth.uid() or public.can_see_location(for_user)));
create policy "Creator edits zone" on public.zones for update to authenticated
using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "Creator deletes zone" on public.zones for delete to authenticated
using (created_by = auth.uid());

-- Alerts: read-only for the person and watchers; changes go through functions.
create policy "Read alerts you are part of" on public.alerts for select to authenticated
using (for_user = auth.uid() or auth.uid() = any (watcher_ids));

create policy "See shared locations" on public.user_locations for select to authenticated
using (public.can_see_location(user_id));
create policy "Write own location" on public.user_locations for insert to authenticated
with check (user_id = auth.uid());
create policy "Update own location" on public.user_locations for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Read recordings of visible alerts" on public.sos_recordings for select to authenticated
using (public.can_see_alert(alert_id));
create policy "Add own recordings" on public.sos_recordings for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from alerts a where a.id = alert_id and a.for_user = auth.uid()));

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- Show who a code belongs to before connecting.
create or replace function public.preview_invite_code(code text)
returns table (id uuid, display_name text, tint smallint)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.tint from profiles p
  where p.invite_code = upper(trim(code)) and p.id <> auth.uid();
$$;

-- Send a request (or accept one) by creating your side of the connection.
create or replace function public.connect_with_code(code text, label text, template uuid, share boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  select p.id into target from profiles p where p.invite_code = upper(trim(code)) and p.id <> auth.uid();
  if target is null then raise exception 'No one has that code'; end if;
  insert into connections (owner_id, other_id, label, template_id, shares_location)
  values (auth.uid(), target, label, template, share)
  on conflict (owner_id, other_id) do update
    set label = excluded.label, template_id = excluded.template_id, shares_location = excluded.shares_location;
  return target;
end $$;

create or replace function public.accept_request(other uuid, label text, template uuid, share boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from connections where owner_id = other and other_id = auth.uid()) then
    raise exception 'No request from this person';
  end if;
  insert into connections (owner_id, other_id, label, template_id, shares_location)
  values (auth.uid(), other, label, template, share)
  on conflict (owner_id, other_id) do nothing;
end $$;

-- Removes both sides, circle memberships and zones between the two people.
create or replace function public.remove_person(other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from connections where (owner_id = auth.uid() and other_id = other)
                             or (owner_id = other and other_id = auth.uid());
  delete from circle_members m using circles c
    where m.circle_id = c.id and ((c.owner_id = auth.uid() and m.member_id = other)
                               or (c.owner_id = other and m.member_id = auth.uid()));
  delete from zones where (created_by = auth.uid() and for_user = other)
                      or (created_by = other and for_user = auth.uid());
end $$;

-- Everyone the signed-in user has a connection with, from their side.
create or replace function public.my_people()
returns table (
  id uuid, display_name text, tint smallint,
  label text, template_id uuid, i_share boolean,
  status text, they_share boolean,
  lat double precision, lng double precision, location_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with mine as (
    select c.other_id, c.label, c.template_id, c.shares_location from connections c where c.owner_id = auth.uid()
  ),
  incoming as (
    select c.owner_id as other_id from connections c
    where c.other_id = auth.uid()
      and not exists (select 1 from connections r where r.owner_id = auth.uid() and r.other_id = c.owner_id)
  ),
  everyone as (
    select m.other_id, m.label, m.template_id, m.shares_location,
           case when exists (select 1 from connections r where r.owner_id = m.other_id and r.other_id = auth.uid())
                then 'connected' else 'pending' end as status
    from mine m
    union all
    select i.other_id, null, null, false, 'incoming' from incoming i
  )
  select e.other_id, p.display_name, p.tint, e.label, e.template_id, e.shares_location, e.status,
         public.can_see_location(e.other_id) and e.other_id <> auth.uid() as they_share,
         case when public.can_see_location(e.other_id) then l.lat end,
         case when public.can_see_location(e.other_id) then l.lng end,
         case when public.can_see_location(e.other_id) then l.updated_at end
  from everyone e
  join profiles p on p.id = e.other_id
  left join user_locations l on l.user_id = e.other_id;
$$;

create or replace function public.answer_ok(alert uuid) returns void
language sql security definer set search_path = public as $$
  update alerts set stage = 'resolved', resolved_how = 'said-ok', resolved_at = now(), stage_ends_at = null
  where id = alert and for_user = auth.uid() and stage in ('left', 'checking');
$$;

create or replace function public.mark_safe(alert uuid) returns void
language sql security definer set search_path = public as $$
  update alerts set stage = 'resolved', resolved_how = 'marked-safe', resolved_at = now(), stage_ends_at = null
  where id = alert and stage <> 'resolved' and (for_user = auth.uid() or auth.uid() = any (watcher_ids));
$$;

-- Skip the wait: from "left"/"checking" straight to SOS, or a fresh manual SOS.
create or replace function public.sos_now(alert uuid, lat double precision, lng double precision)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if alert is not null then
    update alerts set stage = 'sos', sos_at = now(), stage_ends_at = null
    where id = alert and for_user = auth.uid() and stage in ('left', 'checking');
    return alert;
  end if;

  select id into new_id from alerts
    where for_user = auth.uid() and kind = 'manual' and stage = 'sos' limit 1;
  if new_id is not null then return new_id; end if;

  -- A manual SOS reaches everyone you're connected to.
  insert into alerts (kind, for_user, watcher_ids, stage, sos_at, lat, lng)
  values ('manual', auth.uid(),
          array(select c.other_id from connections c
                where c.owner_id = auth.uid() and public.is_connected(auth.uid(), c.other_id)),
          'sos', now(), lat, lng)
  returning id into new_id;
  return new_id;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.user_locations, public.alerts, public.zones;

-- ---------------------------------------------------------------------------
-- Only signed-in users may call the app functions
-- ---------------------------------------------------------------------------

do $$
declare f text;
begin
  foreach f in array array[
    'preview_invite_code(text)', 'connect_with_code(text,text,uuid,boolean)',
    'accept_request(uuid,text,uuid,boolean)', 'remove_person(uuid)', 'my_people()',
    'answer_ok(uuid)', 'mark_safe(uuid)', 'sos_now(uuid,double precision,double precision)',
    'advance_alerts()', 'can_see_location(uuid)', 'can_see_alert(uuid)', 'is_connected(uuid,uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
