-- ============================================================================
-- ESG Astraa HRMS — Fix admin bootstrap
-- The privilege-guard trigger reverted role/can_chat/employee_id changes for
-- anyone who isn't an authenticated admin. But in the SQL editor / service role
-- context, auth.uid() is NULL, so is_admin() is false — which meant the trigger
-- ALSO reverted the very UPDATE used to create the first admin (deadlock).
--
-- Fix: only restrict AUTHENTICATED non-admin users (auth.uid() IS NOT NULL).
-- Service-role / SQL-editor operations (auth.uid() IS NULL) and admins may set
-- privileged columns. Employees still cannot self-promote via the app.
-- ============================================================================

create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role        := old.role;
    new.can_chat    := old.can_chat;
    new.employee_id := old.employee_id;
  end if;
  return new;
end;
$$;
