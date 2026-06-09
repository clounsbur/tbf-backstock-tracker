create or replace function public.move_pallet(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pallet record;
  v_product record;
  v_destination record;
  v_current_pallet_id text;
  v_from_location record;
  v_from_location_id text;
  v_to_location_id text;
  v_move_id text := gen_random_uuid()::text;
  v_reason_code text := coalesce(input->>'reason_code', 'STANDARD_MOVE');
begin
  if nullif(input->>'pallet_id', '') is null and nullif(input->>'pallet_license_plate', '') is null then
    raise exception 'Provide pallet_id or pallet_license_plate';
  end if;

  if nullif(input->>'to_location_id', '') is null and nullif(input->>'to_location_code', '') is null then
    raise exception 'Provide to_location_id or to_location_code';
  end if;

  if nullif(input->>'moved_by', '') is null then
    raise exception 'moved_by is required';
  end if;

  if v_reason_code not in ('STANDARD_MOVE', 'INBOUND_PUTAWAY', 'OVERFLOW_RELOCATION', 'RECLAIM_HOME_SLOT', 'CONSOLIDATION', 'ADJUSTMENT') then
    raise exception 'Invalid reason_code';
  end if;

  select p.*
  into v_pallet
  from public.pallets p
  where (nullif(input->>'pallet_id', '') is not null and p.id = input->>'pallet_id')
     or (nullif(input->>'pallet_id', '') is null and p.pallet_license_plate = input->>'pallet_license_plate')
  for update;

  if not found then
    raise exception 'Pallet not found';
  end if;

  select pr.*
  into v_product
  from public.products pr
  where pr.id = v_pallet.product_id;

  if not found then
    raise exception 'Product not found';
  end if;

  select l.*, wa.area_type
  into v_destination
  from public.locations l
  join public.warehouse_areas wa on wa.id = l.area_id
  where (nullif(input->>'to_location_id', '') is not null and l.id = input->>'to_location_id')
     or (nullif(input->>'to_location_id', '') is null and l.full_location_code = input->>'to_location_code')
  for update;

  if not found then
    raise exception 'Destination location not found';
  end if;

  v_from_location_id := v_pallet.current_location_id;
  v_to_location_id := v_destination.id;

  if v_from_location_id = v_to_location_id then
    raise exception 'Pallet is already in that location';
  end if;

  if v_destination.status = 'BLOCKED' then
    raise exception 'Destination location is blocked';
  end if;

  select p.id
  into v_current_pallet_id
  from public.pallets p
  where p.current_location_id = v_to_location_id
  for update;

  if v_current_pallet_id is not null then
    raise exception 'Destination location is already occupied';
  end if;

  if v_destination.is_front_home_slot and v_destination.home_product_id is distinct from v_pallet.product_id then
    raise exception 'Front home slots are reserved for their assigned SKU';
  end if;

  if v_destination.home_product_id is not null
    and v_destination.home_product_id <> v_pallet.product_id
    and (not v_destination.is_flex_slot or not v_destination.allows_overflow) then
    raise exception 'Overflow can only use locations marked as flex overflow-capable';
  end if;

  if v_destination.home_product_id is not null
    and v_destination.home_product_id <> v_pallet.product_id
    and v_destination.part_number_start is not null
    and v_destination.part_number_end is not null
    and (v_product.item_code < v_destination.part_number_start or v_product.item_code > v_destination.part_number_end) then
    raise exception 'Overflow must stay within the destination part-number neighborhood';
  end if;

  if v_destination.area_type = 'OVERFLOW' and not v_destination.allows_overflow then
    raise exception 'Temporary overflow locations must be marked overflow-capable';
  end if;

  if v_from_location_id is not null then
    select l.*
    into v_from_location
    from public.locations l
    where l.id = v_from_location_id
    for update;
  end if;

  update public.pallets
  set current_location_id = v_to_location_id,
      status = 'AVAILABLE'
  where id = v_pallet.id;

  insert into public.move_transactions (
    id,
    pallet_id,
    product_id,
    from_location_id,
    to_location_id,
    moved_by,
    reason_code,
    notes
  )
  values (
    v_move_id,
    v_pallet.id,
    v_pallet.product_id,
    v_from_location_id,
    v_to_location_id,
    input->>'moved_by',
    v_reason_code,
    nullif(input->>'notes', '')
  );

  update public.locations
  set status = case
    when v_destination.home_product_id is not null and v_destination.home_product_id <> v_pallet.product_id then 'OCCUPIED_OVERFLOW_SKU'
    when v_destination.home_product_id is null and v_destination.is_flex_slot and v_destination.allows_overflow then 'OCCUPIED_OVERFLOW_SKU'
    else 'OCCUPIED_HOME_SKU'
  end
  where id = v_to_location_id;

  if v_from_location_id is not null then
    update public.locations
    set status = case
      when status = 'BLOCKED' then 'BLOCKED'
      when is_front_home_slot then 'RESERVED_HOME_SLOT'
      when is_flex_slot then 'OPEN_FLEX_SLOT'
      else 'OPEN'
    end
    where id = v_from_location_id;
  end if;

  return jsonb_build_object('palletId', v_pallet.id, 'moveId', v_move_id);
end;
$$;
