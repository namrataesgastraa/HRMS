-- ============================================================================
-- Store the actual date of birth (onboarding previously kept only the computed
-- `age`). Lets employees view/edit their DOB; `age` is derived from it on save.
-- ============================================================================

alter table public.employee_details
  add column if not exists dob date;
