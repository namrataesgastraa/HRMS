-- ============================================================================
-- ESG Astraa HRMS — Profile directory read access
-- Team chat (and @-mentions/avatars) needs every signed-in user to see other
-- users' names. This relaxes the profiles SELECT policy from own-row-only to
-- "any authenticated user can read profiles". Writes are still guarded:
-- the enforce_profile_update_rules trigger prevents non-admins from changing
-- role / can_chat / employee_id, so this only widens READ access to basic
-- directory info within the company — appropriate for an internal tool.
-- ============================================================================

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() is not null);
