-- Let warehouse staff add new storage locations (and, when the floor changes,
-- whole new areas) from the app instead of requiring a SQL migration. Mirrors
-- the move_pallet RPC pattern: anon/authenticated get EXECUTE on a validated
-- SECURITY DEFINER function rather than raw INSERT grants on the tables.

create or replace function public.create_warehouse_area(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := gen_random_uuid()::text;
  v_name text := nullif(trim(input->>'name'), '');
  v_area_type text := coalesce(input->>'area_type', 'BACKSTOCK');
  v_is_floor_stacked boolean := coalesce((input->>'is_floor_stacked')::boolean, false);
  v_is_last_resort boolean := coalesce((input->>'is_last_resort')::boolean, false);
  v_sort_order integer;
  v_row record;
begin
  if v_name is null then
    raise exception 'name is required';
  end if;

  if v_area_type not in ('FRONT_HOME', 'BACKSTOCK', 'FLEX_RESERVE', 'OVERFLOW', 'RECEIVING') then
    raise exception 'Invalid area_type';
  end if;

  if exists (select 1 from public.warehouse_areas where name = v_name) then
    raise exception 'An area named % already exists', v_name;
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort_order from public.warehouse_areas;

  insert into public.warehouse_areas (id, name, area_type, sort_order, is_last_resort, is_floor_stacked)
  values (v_id, v_name, v_area_type, v_sort_order, v_is_last_resort, v_is_floor_stacked)
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.create_warehouse_area(jsonb) to anon, authenticated;

create or replace function public.create_location(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := gen_random_uuid()::text;
  v_area_id text := nullif(input->>'area_id', '');
  v_zone text := nullif(trim(input->>'zone'), '');
  v_aisle text := nullif(trim(input->>'aisle'), '');
  v_bay text := nullif(trim(input->>'bay'), '');
  v_level text := coalesce(nullif(trim(input->>'level'), ''), '1');
  v_depth integer := coalesce((input->>'depth_position')::integer, 1);
  v_storage_type text := coalesce(input->>'storage_type', 'PERMANENT');
  v_code text := nullif(trim(input->>'full_location_code'), '');
  v_allows_overflow boolean;
  v_row record;
begin
  if v_area_id is null then
    raise exception 'area_id is required';
  end if;

  if not exists (select 1 from public.warehouse_areas where id = v_area_id) then
    raise exception 'Unknown area_id';
  end if;

  if v_zone is null or v_aisle is null or v_bay is null then
    raise exception 'zone, aisle, and bay are required';
  end if;

  if v_storage_type not in ('PERMANENT', 'TEMPORARY') then
    raise exception 'storage_type must be PERMANENT or TEMPORARY';
  end if;

  v_allows_overflow := (v_storage_type = 'TEMPORARY');

  if v_code is null then
    v_code := upper(v_zone || '-' || v_aisle || '-' || v_bay || '-' || v_level || '-' || v_depth);
  end if;

  if exists (select 1 from public.locations where full_location_code = v_code) then
    raise exception 'A location with code % already exists', v_code;
  end if;

  insert into public.locations (
    id, area_id, zone, aisle, bay, level, depth_position, full_location_code,
    is_front_home_slot, is_flex_slot, allows_overflow, status
  )
  values (
    v_id, v_area_id, v_zone, v_aisle, v_bay, v_level, v_depth, v_code,
    false, false, v_allows_overflow, 'OPEN'
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.create_location(jsonb) to anon, authenticated;
