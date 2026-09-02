-- Bulk resize of an area's permanent-location grid: add missing aisle/bay/
-- depth combinations, or remove ones that are currently empty. Matches
-- existing rows by their actual columns (area_id/zone/aisle/bay/level/
-- depth_position), not by full_location_code -- older areas were seeded by
-- hand with inconsistent code formats, so the columns are the only reliable
-- identity. Removal only ever deletes a location that is status = 'OPEN'
-- and has no pallet sitting on it; anything occupied is reported as skipped,
-- never deleted. Supports dry_run so the UI can preview before committing.

create or replace function public.resize_permanent_locations(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area_id text := nullif(input->>'area_id', '');
  v_zone text := nullif(trim(input->>'zone'), '');
  v_level text := coalesce(nullif(trim(input->>'level'), ''), '1');
  v_action text := input->>'action';
  v_dry_run boolean := coalesce((input->>'dry_run')::boolean, true);
  v_aisle_start int := (input->>'aisle_start')::int;
  v_aisle_end int := (input->>'aisle_end')::int;
  v_bay_start int := (input->>'bay_start')::int;
  v_bay_end int := (input->>'bay_end')::int;
  v_depth_start int := coalesce((input->>'depth_start')::int, 1);
  v_depth_end int := coalesce((input->>'depth_end')::int, 1);
  v_added int := 0;
  v_would_add int := 0;
  v_removed int := 0;
  v_would_remove int := 0;
  v_skipped_occupied int := 0;
  a int;
  b int;
  d int;
  v_existing_id text;
  v_code text;
begin
  if v_area_id is null or v_zone is null then
    raise exception 'area_id and zone are required';
  end if;

  if not exists (select 1 from public.warehouse_areas where id = v_area_id) then
    raise exception 'Unknown area_id';
  end if;

  if v_action not in ('ADD', 'REMOVE') then
    raise exception 'action must be ADD or REMOVE';
  end if;

  if v_aisle_start is null or v_aisle_end is null or v_bay_start is null or v_bay_end is null
     or v_aisle_start > v_aisle_end or v_bay_start > v_bay_end or v_depth_start > v_depth_end then
    raise exception 'Invalid aisle/bay/depth range';
  end if;

  for a in v_aisle_start..v_aisle_end loop
    for b in v_bay_start..v_bay_end loop
      for d in v_depth_start..v_depth_end loop
        select id into v_existing_id
        from public.locations
        where area_id = v_area_id
          and zone = v_zone
          and aisle = a::text
          and bay = b::text
          and level = v_level
          and depth_position = d
          and allows_overflow = false
        limit 1;

        if v_action = 'ADD' then
          if v_existing_id is null then
            v_would_add := v_would_add + 1;
            if not v_dry_run then
              v_code := v_zone || '-' || lpad(a::text, 2, '0') || '-' || lpad(b::text, 2, '0') || '-' || v_level || '-' || d;
              insert into public.locations (
                id, area_id, zone, aisle, bay, level, depth_position, full_location_code,
                is_front_home_slot, is_flex_slot, allows_overflow, status
              )
              values (
                gen_random_uuid()::text, v_area_id, v_zone, a::text, b::text, v_level, d, v_code,
                false, false, false, 'OPEN'
              )
              on conflict (full_location_code) do nothing;
              v_added := v_added + 1;
            end if;
          end if;
        elsif v_action = 'REMOVE' then
          if v_existing_id is not null then
            if exists (
              select 1 from public.locations l
              where l.id = v_existing_id and l.status = 'OPEN'
            ) and not exists (
              select 1 from public.pallets p where p.current_location_id = v_existing_id
            ) then
              v_would_remove := v_would_remove + 1;
              if not v_dry_run then
                delete from public.locations where id = v_existing_id;
                v_removed := v_removed + 1;
              end if;
            else
              v_skipped_occupied := v_skipped_occupied + 1;
            end if;
          end if;
        end if;

        v_existing_id := null;
      end loop;
    end loop;
  end loop;

  return jsonb_build_object(
    'action', v_action,
    'dryRun', v_dry_run,
    'wouldAdd', v_would_add,
    'added', v_added,
    'wouldRemove', v_would_remove,
    'removed', v_removed,
    'skippedOccupied', v_skipped_occupied
  );
end;
$$;

grant execute on function public.resize_permanent_locations(jsonb) to anon, authenticated;
