
-- ============================================================================
-- Pallet seed for the 9-area backstock layout (Session 12 build).
-- Respects the same-SKU 2-high floor-stack rule for floor-stacked areas.
-- Idempotent-ish: clears existing pallets first.
-- ============================================================================
begin;

delete from public.move_transactions;
delete from public.pallets;
update public.locations set status = 'OPEN';

do $$
declare
  eights   integer[];
  sixteens integer[];
  allskus  integer[];
  rec      record;
  stack_sku integer;
  chosen   integer;
  lp_seq   integer := 0;
  occupy   boolean;
  is_floor boolean;
begin
  select array_agg(id order by item_code) into eights
    from public.products where item_code ~ '^5' and is_pickable is not false;
  select array_agg(id order by item_code) into sixteens
    from public.products where item_code ~ '^(57|6)' and is_pickable is not false;
  allskus := eights || sixteens;

  if allskus is null or array_length(allskus,1) = 0 then
    raise exception 'No products found to seed pallets';
  end if;

  -- Iterate locations in a stable order so stacks (same bay+depth, level 1 then 2) are adjacent.
  for rec in
    select l.id, l.area_id, l.bay, l.level, l.depth_position,
           w.is_floor_stacked, w.name as area_name
    from public.locations l
    join public.warehouse_areas w on w.id = l.area_id
    order by l.area_id, l.bay, l.depth_position, l.level
  loop
    is_floor := coalesce(rec.is_floor_stacked, false);

    -- Decide occupancy: ~60% occupied, deterministic-ish via hashtext.
    occupy := (abs(hashtext(rec.id)) % 10) < 6;

    if is_floor then
      -- Floor stack: BOTH levels derive SKU + occupancy from the same stack key
      -- (area+bay+depth), so level 1 and level 2 are guaranteed the same SKU and
      -- occupied/empty together — independent of loop order. Enforces the
      -- same-SKU 2-high floor-stack rule at seed time.
      stack_sku := allskus[1 + (abs(hashtext(rec.area_id||rec.bay||rec.depth_position::text)) % array_length(allskus,1))];
      chosen := stack_sku;
      occupy := (abs(hashtext(rec.area_id||rec.bay||rec.depth_position::text)) % 10) < 6;
    else
      chosen := allskus[1 + (abs(hashtext(rec.id)) % array_length(allskus,1))];
    end if;

    if occupy then
      lp_seq := lp_seq + 1;
      insert into public.pallets (pallet_license_plate, product_id, quantity, received_at, current_location_id, status)
      values ('LP-'||lpad(lp_seq::text,5,'0'), chosen, 30 + (abs(hashtext(rec.id)) % 6)*5,
              now() - ((abs(hashtext(rec.id)) % 40) || ' days')::interval, rec.id, 'AVAILABLE');
      update public.locations set status =
        case when rec.area_name = 'Whitefish' then 'OCCUPIED_OVERFLOW_SKU' else 'OCCUPIED_HOME_SKU' end
      where id = rec.id;
    end if;
  end loop;

  -- A few blocked locations for triage realism.
  update public.locations set status = 'BLOCKED'
  where full_location_code in ('SUP-05-3','HUR-04-2','ERI-08-5')
    and not exists (select 1 from public.pallets p where p.current_location_id = locations.id);
end $$;

commit;

-- sanity:
-- select w.name, count(p.id) as pallets, count(l.id) as locs
-- from public.locations l join public.warehouse_areas w on w.id=l.area_id
-- left join public.pallets p on p.current_location_id=l.id
-- group by w.name, w.sort_order order by w.sort_order;
