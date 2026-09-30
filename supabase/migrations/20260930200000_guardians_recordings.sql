-- Guardian agreements (parent/child) and the recordings library.
-- Paste into Supabase > SQL Editor and run once, after the core migration.
--
-- A guardian agreement sits on top of a normal connection and needs both
-- people to accept it. While active:
--   * the guardian always sees the dependent's location (the dependent can't
--     turn it off or pause it for guardians),
--   * only guardians create, edit and end zones for the dependent,
--   * guardians always receive the dependent's alerts and SOS,
--   * only guardians can delete the dependent's SOS recordings.
-- The guardian can end it; the dependent can ask to be released.

create table public.guardianships (
  guardian_id uuid not null references auth.users (id) on delete cascade,
  dependent_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('proposed', 'active', 'release_requested')),
  proposed_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (guardian_id, dependent_id),
  check (guardian_id <> dependent_id)
);
create index guardianships_dependent_idx on public.guardianships (dependent_id);

alter table public.guardianships enable row level security;
create policy "Read your agreements" on public.guardianships for select to authenticated
using (guardian_id = auth.uid() or dependent_id = auth.uid());

create or replace function public.is_guardian(g uuid, d uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from guardianships
                 where guardian_id = g and dependent_id = d and status in ('active', 'release_requested'));
$$;

create or replace function public.has_guardian(d uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from guardianships where dependent_id = d and status in ('active', 'release_requested'));
$$;

-- ---------------------------------------------------------------------------
-- Location: guardians always see their dependents, even when paused.
-- ---------------------------------------------------------------------------

create or replace function public.can_see_location(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
    or public.is_guardian(auth.uid(), target)
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

-- A dependent's sharing toward a guardian stays on.
create or replace function public.keep_guardian_sharing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_guardian(new.other_id, new.owner_id) then
    new.shares_location := true;
  end if;
  return new;
end $$;

create trigger connections_keep_guardian_sharing
  before update on public.connections
  for each row execute function public.keep_guardian_sharing();

-- ---------------------------------------------------------------------------
-- Zones: only guardians set zones for someone who has guardians.
-- ---------------------------------------------------------------------------

drop policy "Create zones for yourself or people sharing with you" on public.zones;
create policy "Create zones you're allowed to set" on public.zones for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    for_user = auth.uid()
    or public.is_guardian(auth.uid(), for_user)
    or (public.can_see_location(for_user) and not public.has_guardian(for_user))
  )
  and not public.is_guardian(for_user, auth.uid())  -- dependents can't set zones on guardians
);

drop policy "Read zones you are part of" on public.zones;
create policy "Read zones you are part of" on public.zones for select to authenticated
using (
  created_by = auth.uid() or for_user = auth.uid() or auth.uid() = any (watcher_ids)
  or public.is_guardian(auth.uid(), for_user)
);

drop policy "Creator edits zone" on public.zones;
create policy "Creator or guardian edits zone" on public.zones for update to authenticated
using (created_by = auth.uid() or public.is_guardian(auth.uid(), for_user))
with check (created_by = auth.uid() or public.is_guardian(auth.uid(), for_user));

drop policy "Creator deletes zone" on public.zones;
create policy "Creator or guardian deletes zone" on public.zones for delete to authenticated
using (created_by = auth.uid() or public.is_guardian(auth.uid(), for_user));

-- ---------------------------------------------------------------------------
-- Alerts: guardians are always watchers.
-- ---------------------------------------------------------------------------

create or replace function public.guardians_of(d uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(guardian_id), '{}') from guardianships
  where dependent_id = d and status in ('active', 'release_requested');
$$;

create or replace function public.add_guardian_watchers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.watcher_ids := array(
    select distinct w from unnest(new.watcher_ids || public.guardians_of(new.for_user)) w where w <> new.for_user
  );
  return new;
end $$;

create trigger alerts_add_guardian_watchers
  before insert on public.alerts
  for each row execute function public.add_guardian_watchers();

-- ---------------------------------------------------------------------------
-- Removing a person: a dependent can't remove their guardian.
-- ---------------------------------------------------------------------------

create or replace function public.remove_person(other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.is_guardian(other, auth.uid()) then
    raise exception 'Your guardian has to end the agreement first. You can ask to be released.';
  end if;
  delete from guardianships where (guardian_id = auth.uid() and dependent_id = other)
                               or (guardian_id = other and dependent_id = auth.uid());
  delete from connections where (owner_id = auth.uid() and other_id = other)
                             or (owner_id = other and other_id = auth.uid());
  delete from circle_members m using circles c
    where m.circle_id = c.id and ((c.owner_id = auth.uid() and m.member_id = other)
                               or (c.owner_id = other and m.member_id = auth.uid()));
  delete from zones where (created_by = auth.uid() and for_user = other)
                      or (created_by = other and for_user = auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- Agreement lifecycle
-- ---------------------------------------------------------------------------

-- I propose to be other's guardian (as_guardian = true), or ask other to be mine.
create or replace function public.propose_guardianship(other uuid, as_guardian boolean) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid; d uuid;
begin
  if not public.is_connected(auth.uid(), other) then
    raise exception 'You need to be connected first';
  end if;
  g := case when as_guardian then auth.uid() else other end;
  d := case when as_guardian then other else auth.uid() end;
  if public.is_guardian(d, g) then
    raise exception 'The agreement already runs the other way';
  end if;
  insert into guardianships (guardian_id, dependent_id, status, proposed_by)
  values (g, d, 'proposed', auth.uid())
  on conflict (guardian_id, dependent_id) do nothing;
end $$;

-- The other person accepts or declines. Proposer can cancel with decline too.
create or replace function public.respond_guardianship(g uuid, d uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare pending guardianships;
begin
  select * into pending from guardianships where guardian_id = g and dependent_id = d and status = 'proposed';
  if pending.guardian_id is null or auth.uid() not in (g, d) then
    raise exception 'No agreement waiting';
  end if;
  if not accept then
    delete from guardianships where guardian_id = g and dependent_id = d;
    return;
  end if;
  if pending.proposed_by = auth.uid() then
    raise exception 'The other person has to accept';
  end if;
  update guardianships set status = 'active', accepted_at = now() where guardian_id = g and dependent_id = d;
  update connections set shares_location = true where owner_id = d and other_id = g;
end $$;

create or replace function public.request_release(g uuid) returns void
language sql security definer set search_path = public as $$
  update guardianships set status = 'release_requested'
  where guardian_id = g and dependent_id = auth.uid() and status = 'active';
$$;

-- Guardian ends the agreement, or turns down a release request.
create or replace function public.end_guardianship(d uuid, release boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if release then
    delete from guardianships where guardian_id = auth.uid() and dependent_id = d;
  else
    update guardianships set status = 'active'
    where guardian_id = auth.uid() and dependent_id = d and status = 'release_requested';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Recordings library: a title per SOS, delete rules
-- ---------------------------------------------------------------------------

alter table public.alerts add column title text check (title is null or length(trim(title)) between 1 and 80);

create or replace function public.can_manage_recordings(alert uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from alerts a where a.id = alert and (
      (a.for_user = auth.uid() and not public.has_guardian(a.for_user))
      or public.is_guardian(auth.uid(), a.for_user)
    )
  );
$$;

create or replace function public.rename_alert(alert uuid, new_title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.can_manage_recordings(alert)
          or exists (select 1 from alerts where id = alert and for_user = auth.uid())) then
    raise exception 'You can''t rename this recording';
  end if;
  update alerts set title = nullif(trim(new_title), '') where id = alert;
end $$;

-- Deletes the clip rows; the app removes the audio files first.
create or replace function public.delete_recordings(alert uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_recordings(alert) then
    raise exception 'Only the person recorded (or their guardian) can delete this';
  end if;
  delete from sos_recordings where alert_id = alert;
end $$;

create policy "Delete SOS audio you manage" on storage.objects for delete to authenticated
using (
  bucket_id = 'sos-recordings'
  and public.can_manage_recordings(((storage.foldername(name))[1])::uuid)
);

-- ---------------------------------------------------------------------------
-- Permissions and realtime
-- ---------------------------------------------------------------------------

do $$
declare f text;
begin
  foreach f in array array[
    'is_guardian(uuid,uuid)', 'has_guardian(uuid)', 'guardians_of(uuid)',
    'propose_guardianship(uuid,boolean)', 'respond_guardianship(uuid,uuid,boolean)',
    'request_release(uuid)', 'end_guardianship(uuid,boolean)',
    'can_manage_recordings(uuid)', 'rename_alert(uuid,text)', 'delete_recordings(uuid)',
    'remove_person(uuid)', 'can_see_location(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.guardianships;
