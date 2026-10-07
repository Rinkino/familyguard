-- Journeys (route monitoring from the project brief) and phone numbers.
-- Paste into Supabase > SQL Editor and run once, after the earlier migrations.
--
-- A journey is a planned route to a destination. While it is active, the
-- server checks every location against the route: straying further than the
-- allowed distance opens an alert that escalates exactly like a zone alert
-- (watchers told -> "Are you OK?" -> SOS). Coming back to the route clears
-- it; reaching the destination ends the journey. Roadblocks the traveller
-- reports are shown to watchers, marked as reported by them.

-- ---------------------------------------------------------------------------
-- Phone numbers (visible to people you're connected with, like your name)
-- ---------------------------------------------------------------------------

alter table public.profiles add column phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$');

drop function public.my_people();
create function public.my_people()
returns table (
  id uuid, display_name text, tint smallint, phone text,
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
  select e.other_id, p.display_name, p.tint,
         case when e.status = 'connected' then p.phone end,
         e.label, e.template_id, e.shares_location, e.status,
         public.can_see_location(e.other_id) and e.other_id <> auth.uid() as they_share,
         case when public.can_see_location(e.other_id) then l.lat end,
         case when public.can_see_location(e.other_id) then l.lng end,
         case when public.can_see_location(e.other_id) then l.updated_at end
  from everyone e
  join profiles p on p.id = e.other_id
  left join user_locations l on l.user_id = e.other_id;
$$;

-- ---------------------------------------------------------------------------
-- Journeys and roadblocks
-- ---------------------------------------------------------------------------

create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  destination_name text not null check (length(trim(destination_name)) between 1 and 120),
  dest_lat double precision not null,
  dest_lng double precision not null,
  mode text not null check (mode in ('walking', 'driving', 'cycling')),
  -- Route as [[lng, lat], ...], from the directions service.
  route jsonb not null check (jsonb_typeof(route) = 'array' and jsonb_array_length(route) between 2 and 5000),
  route_distance_m integer not null,
  route_duration_s integer not null,
  max_deviation_m integer not null default 250 check (max_deviation_m between 50 and 2000),
  grace_min integer not null default 5 check (grace_min between 0 and 60),
  countdown_s integer not null default 30 check (countdown_s between 10 and 300),
  watcher_ids uuid[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'arrived', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index journeys_one_active_idx on public.journeys (user_id) where status = 'active';

create table public.roadblocks (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  note text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now()
);

alter table public.alerts add column journey_id uuid references public.journeys (id) on delete set null;
alter table public.alerts drop constraint alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check check (kind in ('zone', 'manual', 'silence', 'journey'));
alter table public.alerts drop constraint alerts_resolved_how_check;
alter table public.alerts add constraint alerts_resolved_how_check
  check (resolved_how in ('back-inside', 'said-ok', 'marked-safe', 'back-online', 'arrived', 'cancelled'));

create or replace function public.can_see_journey(j uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from journeys x where x.id = j and (
    x.user_id = auth.uid() or auth.uid() = any (x.watcher_ids) or public.is_guardian(auth.uid(), x.user_id)
  ));
$$;

alter table public.journeys enable row level security;
alter table public.roadblocks enable row level security;

create policy "Traveller, watchers and guardians see a journey" on public.journeys for select to authenticated
using (user_id = auth.uid() or auth.uid() = any (watcher_ids) or public.is_guardian(auth.uid(), user_id));
create policy "Start your own journey" on public.journeys for insert to authenticated
with check (user_id = auth.uid());
create policy "Change your own journey" on public.journeys for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "See roadblocks on journeys you can see" on public.roadblocks for select to authenticated
using (public.can_see_journey(journey_id));
create policy "Report roadblocks on your journey" on public.roadblocks for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from journeys j where j.id = journey_id and j.user_id = auth.uid()));

-- Shortest distance in metres from a point to a [[lng, lat], ...] polyline.
-- Uses a flat projection around the point: accurate to well under 1% at city scale.
create or replace function public.distance_to_route(route jsonb, lat float8, lng float8) returns float8
language plpgsql immutable as $$
declare
  k float8 := cos(radians(lat)) * 111320;  -- metres per degree of longitude here
  m float8 := 111320;                      -- metres per degree of latitude
  best float8 := 'Infinity';
  i int;
  x1 float8; y1 float8; x2 float8; y2 float8; dx float8; dy float8; t float8; px float8; py float8;
begin
  for i in 0 .. jsonb_array_length(route) - 2 loop
    x1 := ((route -> i ->> 0)::float8 - lng) * k;       y1 := ((route -> i ->> 1)::float8 - lat) * m;
    x2 := ((route -> (i + 1) ->> 0)::float8 - lng) * k; y2 := ((route -> (i + 1) ->> 1)::float8 - lat) * m;
    dx := x2 - x1; dy := y2 - y1;
    t := case when dx = 0 and dy = 0 then 0 else greatest(0, least(1, -(x1 * dx + y1 * dy) / (dx * dx + dy * dy))) end;
    px := x1 + t * dx; py := y1 + t * dy;
    best := least(best, sqrt(px * px + py * py));
  end loop;
  return best;
end $$;

-- Runs on every location: arrival, going off route, coming back.
create or replace function public.check_journeys() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j record;
  open_alert record;
  off_by float8;
begin
  select * into j from journeys where user_id = new.user_id and status = 'active';
  if j.id is null then return new; end if;

  select * into open_alert from alerts where journey_id = j.id and stage <> 'resolved' order by left_at desc limit 1;

  -- Arrived: within 100 m of the destination.
  if public.distance_m(new.lat, new.lng, j.dest_lat, j.dest_lng) <= 100 then
    update journeys set status = 'arrived', ended_at = now() where id = j.id;
    if open_alert.id is not null and open_alert.stage in ('left', 'checking') then
      update alerts set stage = 'resolved', resolved_how = 'arrived', resolved_at = now(), stage_ends_at = null
      where id = open_alert.id;
    end if;
    return new;
  end if;

  off_by := public.distance_to_route(j.route, new.lat, new.lng);

  if off_by > j.max_deviation_m and open_alert.id is null then
    insert into alerts (kind, journey_id, zone_name, for_user, watcher_ids, stage,
                        countdown_s, stage_ends_at, lat, lng)
    values ('journey', j.id, 'the route to ' || j.destination_name, j.user_id,
            array(select distinct w from unnest(j.watcher_ids) w where w <> j.user_id),
            'left', j.countdown_s, now() + make_interval(mins => j.grace_min), new.lat, new.lng);
  elsif off_by <= j.max_deviation_m and open_alert.id is not null and open_alert.stage in ('left', 'checking') then
    update alerts set stage = 'resolved', resolved_how = 'back-inside', resolved_at = now(), stage_ends_at = null
    where id = open_alert.id;
  elsif open_alert.id is not null then
    update alerts set lat = new.lat, lng = new.lng where id = open_alert.id;
  end if;
  return new;
end $$;

create trigger user_locations_check_journeys
  after insert or update on public.user_locations
  for each row execute function public.check_journeys();

-- Ending a journey yourself closes any alert still waiting on it.
create or replace function public.end_journey(j uuid, arrived boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update journeys set status = case when arrived then 'arrived' else 'cancelled' end, ended_at = now()
  where id = j and user_id = auth.uid() and status = 'active';
  update alerts set stage = 'resolved', resolved_at = now(), stage_ends_at = null,
                    resolved_how = case when arrived then 'arrived' else 'cancelled' end
  where journey_id = j and for_user = auth.uid() and stage in ('left', 'checking');
end $$;

-- Swap in a new route (e.g. after a roadblock). Clears an off-route alert that hasn't reached SOS.
create or replace function public.reroute_journey(j uuid, new_route jsonb, distance_m integer, duration_s integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  update journeys set route = new_route, route_distance_m = distance_m, route_duration_s = duration_s
  where id = j and user_id = auth.uid() and status = 'active';
  update alerts set stage = 'resolved', resolved_how = 'back-inside', resolved_at = now(), stage_ends_at = null
  where journey_id = j and for_user = auth.uid() and stage in ('left', 'checking');
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'my_people()', 'can_see_journey(uuid)', 'end_journey(uuid,boolean)',
    'reroute_journey(uuid,jsonb,integer,integer)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.journeys, public.roadblocks;
