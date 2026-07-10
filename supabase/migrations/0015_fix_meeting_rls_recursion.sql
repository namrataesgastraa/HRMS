-- ============================================================================
-- Fix: "infinite recursion detected in policy for relation meetings".
-- meetings_select referenced meeting_attendees and mattend_select referenced
-- meetings → the two policies invoked each other endlessly. Route the
-- cross-table lookups through SECURITY DEFINER helpers (which bypass RLS), the
-- same pattern as is_admin()/is_manager_of().
-- ============================================================================

create or replace function public.is_meeting_attendee(m_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.meeting_attendees
    where meeting_id = m_id and profile_id = auth.uid()
  );
$$;

create or replace function public.is_meeting_host(m_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.meetings where id = m_id and host_id = auth.uid()
  );
$$;

-- Meetings: host, admin, or invitee (via definer helper — no recursion).
drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select using (
    host_id = auth.uid()
    or public.is_admin()
    or public.is_meeting_attendee(id)
  );

-- Attendees: the invitee, the host (via helper), or admin.
drop policy if exists mattend_select on public.meeting_attendees;
create policy mattend_select on public.meeting_attendees
  for select using (
    profile_id = auth.uid()
    or public.is_admin()
    or public.is_meeting_host(meeting_id)
  );

drop policy if exists mattend_insert on public.meeting_attendees;
create policy mattend_insert on public.meeting_attendees
  for insert with check (
    (public.is_admin() or public.is_meeting_host(meeting_id))
    and (public.is_admin() or public.is_manager_of(profile_id))
  );

drop policy if exists mattend_delete on public.meeting_attendees;
create policy mattend_delete on public.meeting_attendees
  for delete using (
    public.is_admin() or public.is_meeting_host(meeting_id)
  );
