-- ============================================================================
-- Fix: indoor offices have weak GPS (±100 m+ is normal even for someone sitting
-- at their desk). The strict ±100 m hard-block in 0021 was rejecting employees
-- who are genuinely present. This makes the accuracy limit CONFIGURABLE per
-- office (default 150 m) and flags coarse readings for admin review
-- instead of blocking. Geofence (distance <= radius) + mock + WiFi/IP + risk
-- flags remain the real defences.
-- ============================================================================

alter table public.office_locations
  add column if not exists max_accuracy_meters int not null default 150;

create or replace function public.record_check_in(
  p_lat        double precision,
  p_lng        double precision,
  p_accuracy   double precision,
  p_is_mock    boolean,
  p_device_id  text,
  p_ip         text,
  p_user_agent text,
  p_source     text default 'web'
) returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_now    timestamptz := now();
  v_local  timestamptz := v_now at time zone 'Asia/Kolkata';
  v_hour   int;
  v_office public.office_locations%rowtype;
  v_dist   double precision;
  v_status text;
  v_flags  jsonb := '[]'::jsonb;
  v_prev   public.attendance%rowtype;
  v_kmh    double precision;
  v_onnet  boolean := true;
  v_row    public.attendance%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated.'; end if;
  v_hour := extract(hour from v_local);

  if exists (
    select 1 from public.attendance a
    where a.profile_id = v_uid
      and (a.check_in_time at time zone 'Asia/Kolkata')::date = v_local::date
  ) then
    raise exception 'You have already marked attendance today.';
  end if;

  -- HARD BLOCK: mock / spoofed GPS.
  if coalesce(p_is_mock, false) then
    raise exception 'Mock or spoofed location detected — check-in blocked.';
  end if;

  if p_lat is null or p_lng is null then
    raise exception 'No location provided.';
  end if;

  -- Nearest office + distance computed HERE (client value is ignored).
  select o.* into v_office
  from public.office_locations o
  order by public.haversine_meters(p_lat, p_lng, o.latitude, o.longitude) asc
  limit 1;
  if v_office.id is null then raise exception 'No office location configured.'; end if;

  v_dist := public.haversine_meters(p_lat, p_lng, v_office.latitude, v_office.longitude);

  -- HARD BLOCK: only truly useless (coarse network) fixes, using the office's
  -- configurable limit (default 200 m). Legit indoor GPS is allowed + flagged.
  if p_accuracy is null or p_accuracy > coalesce(v_office.max_accuracy_meters, 150) then
    raise exception 'Location too coarse (±% m). Turn ON Precise Location, go near a window and retry.',
      coalesce(round(p_accuracy)::text, '?');
  end if;
  -- Informational: readings that are coarse relative to the geofence.
  if p_accuracy > greatest(v_office.radius_meters, 75) then
    v_flags := v_flags || '["coarse_location"]'::jsonb;
  end if;

  -- HARD BLOCK: outside the geofence.
  if v_dist > v_office.radius_meters then
    raise exception 'You are % m from the office (allowed: % m).',
      round(v_dist), v_office.radius_meters;
  end if;

  -- HARD BLOCK: outside office hours.
  if v_hour < 6 or v_hour >= 22 then
    raise exception 'Outside check-in hours.';
  end if;

  -- Office network (WiFi) check.
  if exists (select 1 from public.office_networks) then
    begin
      v_onnet := exists (
        select 1 from public.office_networks n where p_ip::inet <<= n.cidr
      );
    exception when others then
      v_onnet := false;
    end;
    if not v_onnet then
      if v_office.enforce_network then
        raise exception 'Check-in must be from the office network (WiFi).';
      end if;
      v_flags := v_flags || '["off_network_ip"]'::jsonb;
    end if;
  end if;

  -- ---- Risk signals ----
  if exists (
    select 1 from public.attendance a
    where a.profile_id = v_uid
      and a.check_in_lat = p_lat and a.check_in_lng = p_lng
  ) then
    v_flags := v_flags || '["repeated_exact_coordinates"]'::jsonb;
  end if;

  select * into v_prev from public.attendance a
  where a.profile_id = v_uid and a.check_in_lat is not null
  order by a.check_in_time desc limit 1;
  if v_prev.id is not null then
    v_kmh := public.haversine_meters(p_lat, p_lng, v_prev.check_in_lat, v_prev.check_in_lng)
             / greatest(extract(epoch from (v_now - v_prev.check_in_time)), 1) * 3.6;
    if v_kmh > 250 then
      v_flags := v_flags || '["impossible_travel"]'::jsonb;
    end if;
  end if;

  if p_accuracy <= 1 then
    v_flags := v_flags || '["implausible_accuracy"]'::jsonb;
  end if;

  if coalesce(p_source, 'web') <> 'native' then
    v_flags := v_flags || '["web_client"]'::jsonb;
  end if;

  v_status := case when v_hour >= 12 then 'late' else 'present' end;

  insert into public.attendance (
    profile_id, office_id, check_in_time, check_in_lat, check_in_lng,
    distance_meters, is_mock_location, status,
    accuracy_meters, ip_address, user_agent, device_id, risk_flags, source
  ) values (
    v_uid, v_office.id, v_now, p_lat, p_lng,
    round(v_dist), false, v_status,
    p_accuracy, p_ip, p_user_agent, p_device_id, v_flags, coalesce(p_source, 'web')
  ) returning * into v_row;

  return v_row;
end; $$;
