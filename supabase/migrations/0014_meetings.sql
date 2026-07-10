-- ============================================================================
-- ESG Astraa HRMS — Team meetings
-- - Admin schedules meetings and invites anyone; managers schedule meetings for
--   their own department members only.
-- - Invitees (and the host/admin) can see the meeting incl. link + optional
--   access credentials. A notification is created for each invitee.
-- Requires helpers from 0008: is_admin(), is_manager_of(uuid), my_department().
-- ============================================================================

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  meeting_link text,
  access_username text,
  access_password text,
  scheduled_at timestamptz not null,
  department text,
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  unique (meeting_id, profile_id)
);

create index if not exists idx_meetings_sched on public.meetings (scheduled_at desc);
create index if not exists idx_meeting_attendees_profile
  on public.meeting_attendees (profile_id);

alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;

-- Meetings: host, admin, or an invitee can read.
drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select using (
    host_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.meeting_attendees a
      where a.meeting_id = meetings.id and a.profile_id = auth.uid()
    )
  );

-- Only admins and managers can create meetings (as themselves).
drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert on public.meetings
  for insert with check (
    host_id = auth.uid()
    and (
      public.is_admin()
      or (select role from public.profiles where id = auth.uid()) = 'manager'
    )
  );

drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings
  for update using (host_id = auth.uid() or public.is_admin())
  with check (host_id = auth.uid() or public.is_admin());

drop policy if exists meetings_delete on public.meetings;
create policy meetings_delete on public.meetings
  for delete using (host_id = auth.uid() or public.is_admin());

-- Attendees: the invitee, the host, or an admin can read.
drop policy if exists mattend_select on public.meeting_attendees;
create policy mattend_select on public.meeting_attendees
  for select using (
    profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.host_id = auth.uid()
    )
  );

-- Add attendees: only the meeting's host (or admin). Managers may only invite
-- members of their own department (is_manager_of); admins may invite anyone.
drop policy if exists mattend_insert on public.meeting_attendees;
create policy mattend_insert on public.meeting_attendees
  for insert with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and (m.host_id = auth.uid() or public.is_admin())
    )
    and (public.is_admin() or public.is_manager_of(profile_id))
  );

drop policy if exists mattend_delete on public.meeting_attendees;
create policy mattend_delete on public.meeting_attendees
  for delete using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and (m.host_id = auth.uid() or public.is_admin())
    )
  );

-- Notify each invitee (SECURITY DEFINER bypasses notifications RLS).
create or replace function public.notify_on_meeting_invite()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select title, scheduled_at into m from public.meetings where id = new.meeting_id;
  insert into public.notifications (profile_id, type, title, body, link)
  values (
    new.profile_id, 'meeting', 'Team meeting scheduled',
    coalesce(m.title, 'Meeting') || ' · '
      || to_char(m.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM'),
    '/meetings'
  );
  return new;
end; $$;

drop trigger if exists on_meeting_invite on public.meeting_attendees;
create trigger on_meeting_invite
  after insert on public.meeting_attendees
  for each row execute function public.notify_on_meeting_invite();
