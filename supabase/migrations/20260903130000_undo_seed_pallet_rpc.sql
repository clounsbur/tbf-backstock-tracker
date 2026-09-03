-- One-level undo for Scan & Store. Reversing a seedPallet call means
-- deleting its pallet row, but move_transactions.pallet_id is
-- ON DELETE RESTRICT, so the INBOUND_PUTAWAY log row it created has to go
-- first -- and move_transactions has no DELETE grant for the client (writes
-- go through validated RPCs only, per this project's convention), so this
-- needs a real RPC rather than a couple of direct table calls.
--
-- Each item is only undone if it's still exactly the state seedPallet left
-- it in: the pallet is still AVAILABLE, still sitting in the same location,
-- and has never been moved or released since (exactly one move_transactions
-- row -- its original putaway). Anything else is silently skipped rather
-- than erroring, so a multi-location "Store" can still undo whatever it
-- safely can even if one pallet was already moved on.
create or replace function public.undo_seed_pallet(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_pallet_id text;
  v_location_id text;
  v_previous_status text;
  v_pallet record;
  v_move_count int;
  v_undone int := 0;
  v_skipped int := 0;
begin
  for v_item in select * from jsonb_array_elements(coalesce(input->'items', '[]'::jsonb))
  loop
    v_pallet_id := v_item->>'palletId';
    v_location_id := v_item->>'locationId';
    v_previous_status := v_item->>'previousStatus';

    select * into v_pallet from public.pallets where id = v_pallet_id;

    if v_pallet is null
       or v_pallet.status <> 'AVAILABLE'
       or v_pallet.current_location_id is distinct from v_location_id
    then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select count(*) into v_move_count from public.move_transactions where pallet_id = v_pallet_id;
    if v_move_count <> 1 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    delete from public.move_transactions where pallet_id = v_pallet_id;
    delete from public.pallets where id = v_pallet_id;
    update public.locations set status = coalesce(v_previous_status, 'OPEN') where id = v_location_id;

    v_undone := v_undone + 1;
  end loop;

  return jsonb_build_object('undone', v_undone, 'skipped', v_skipped);
end;
$$;

grant execute on function public.undo_seed_pallet(jsonb) to anon, authenticated;
