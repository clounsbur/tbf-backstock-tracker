-- Editing an existing area's name/type/flags. Mirrors create_warehouse_area:
-- anon/authenticated get EXECUTE on a validated SECURITY DEFINER function
-- rather than a raw UPDATE grant on warehouse_areas.

create or replace function public.update_warehouse_area(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := nullif(input->>'id', '');
  v_name text := nullif(trim(input->>'name'), '');
  v_area_type text := input->>'area_type';
  v_is_floor_stacked boolean := (input->>'is_floor_stacked')::boolean;
  v_is_last_resort boolean := (input->>'is_last_resort')::boolean;
  v_row record;
begin
  if v_id is null then
    raise exception 'id is required';
  end if;

  if not exists (select 1 from public.warehouse_areas where id = v_id) then
    raise exception 'Unknown area id';
  end if;

  if v_area_type is not null and v_area_type not in ('FRONT_HOME', 'BACKSTOCK', 'FLEX_RESERVE', 'OVERFLOW', 'RECEIVING') then
    raise exception 'Invalid area_type';
  end if;

  update public.warehouse_areas
  set
    name = coalesce(v_name, name),
    area_type = coalesce(v_area_type, area_type),
    is_floor_stacked = coalesce(v_is_floor_stacked, is_floor_stacked),
    is_last_resort = coalesce(v_is_last_resort, is_last_resort)
  where id = v_id
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.update_warehouse_area(jsonb) to anon, authenticated;
