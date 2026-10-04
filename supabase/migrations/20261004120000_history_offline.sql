-- Location history (7 days), offline upload, and "stopped reporting" alerts.
-- Paste into Supabase > SQL Editor and run once, after the earlier migrations.
--
-- History is visible to the person themselves and their guardians only.
-- Friends see live location, not where you've been.

create table public.location_history (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  recorded_at timestamptz not null
);
create index location_history_user_time_idx on public.location_history (user_id, recorded_at desc);

alter table public.location_history enable row level security;
create policy "Own and dependents' history" on public.location_history for select to authenticated
using (user_id = auth.uid() or public.is_guardian(auth.uid(), user_id));

-- Keep a point when someone has moved 30 m, or every 5 minutes while still.
create or replace function public.record_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare last_point record;
begin
  select lat, lng, recorded_at into last_point from location_history
    where user_id = new.user_id order by recorded_at desc limit 1;
  if last_point.recorded_at is null
     or new.updated_at - last_point.recorded_at >= interval '5 minutes'
     or public.distance_m(last_point.lat, last_point.lng, new.lat, new.lng) >= 30 then
    insert into location_history (user_id, lat, lng, accuracy_m, recorded_at)
    values (new.user_id, new.lat, new.lng, new.accuracy_m, new.updated_at);
  end if;
  return new;
end $$;

create trigger user_locations_record_history
  after insert or update on public.user_locations
  for each row execute function public.record_history();

-- ---------------------------------------------------------------------------
-- Offline upload: the phone queues points while offline and sends them in
-- time order when it reconnects. Each point goes through the same zone
-- checks and history as a live point.
-- ---------------------------------------------------------------------------

create or replace function public.report_locations(points jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  p jsonb;
  t timestamptz;
  latest timestamptz;
begin
  for p in
    select value from jsonb_array_elements(points) order by (value ->> 't')::timestamptz
  loop
    t := least((p ->> 't')::timestamptz, now());  -- never trust a future phone clock
    select updated_at into latest from user_locations where user_id = auth.uid();
    if latest is null or t >= latest then
      -- Newer than what we have: becomes the live location (zone checks + history run).
      insert into user_locations (user_id, lat, lng, accuracy_m, updated_at)
      values (auth.uid(), (p ->> 'lat')::float8, (p ->> 'lng')::float8, (p ->> 'acc')::real, t)
      on conflict (user_id) do update
        set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, updated_at = excluded.updated_at;
    else
      -- Older than the live location: just fill the gap in history.
      insert into location_history (user_id, lat, lng, accuracy_m, recorded_at)
      values (auth.uid(), (p ->> 'lat')::float8, (p ->> 'lng')::float8, (p ->> 'acc')::real, t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- "Stopped reporting": someone with a guardian or an active zone hasn't sent
-- a location for 30 minutes. Never escalates to SOS on its own; it clears
-- as soon as a location arrives.
-- ---------------------------------------------------------------------------

alter table public.alerts drop constraint alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check check (kind in ('zone', 'manual', 'silence'));
alter table public.alerts drop constraint alerts_resolved_how_check;
alter table public.alerts add constraint alerts_resolved_how_check
  check (resolved_how in ('back-inside', 'said-ok', 'marked-safe', 'back-online'));

create or replace function public.check_silence() returns void
language plpgsql security definer set search_path = public as $$
declare u record;
begin
  for u in
    select l.user_id, l.lat, l.lng, l.updated_at from user_locations l
    where l.updated_at < now() - interval '30 minutes'
      and l.updated_at > now() - interval '24 hours'
      and not exists (select 1 from alerts a where a.for_user = l.user_id and a.kind = 'silence' and a.stage <> 'resolved')
      and (public.has_guardian(l.user_id)
           or exists (select 1 from zones z where z.for_user = l.user_id and z.active and (z.ends_at is null or z.ends_at > now())))
  loop
    insert into alerts (kind, for_user, watcher_ids, stage, left_at, lat, lng)
    values (
      'silence', u.user_id,
      array(select distinct w from unnest(
        coalesce((select array_agg(x) from zones z, unnest(z.watcher_ids || z.created_by) x
                  where z.for_user = u.user_id and z.active and (z.ends_at is null or z.ends_at > now())), '{}')
      ) w where w <> u.user_id),
      'left', u.updated_at, u.lat, u.lng
    );
  end loop;
end $$;

-- A location arriving clears any "stopped reporting" alert.
create or replace function public.clear_silence() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update alerts set stage = 'resolved', resolved_how = 'back-online', resolved_at = now()
  where for_user = new.user_id and kind = 'silence' and stage <> 'resolved';
  return new;
end $$;

create trigger user_locations_clear_silence
  after insert or update on public.user_locations
  for each row execute function public.clear_silence();

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------

select cron.schedule('check-silence', '* * * * *', 'select public.check_silence()');
select cron.schedule('trim-history', '17 3 * * *',
  $$delete from public.location_history where recorded_at < now() - interval '7 days'$$);

do $$
declare f text;
begin
  foreach f in array array['report_locations(jsonb)', 'check_silence()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
