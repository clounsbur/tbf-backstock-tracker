-- Grant API read access to the inventory tables migrated into the unified
-- TBF Mobile Web APP project in Session 11. The Session-10 blanket
-- `GRANT SELECT ON ALL TABLES ... TO authenticated` ran before these tables
-- existed, so they had no grants and every read returned permission-denied / 401.
--
-- NOTE: This is the broad dev-time grant. Tighten to per-role RLS policies
-- before any production deploy (see high-priority RLS item in the spec).

grant usage on schema public to anon, authenticated;

grant select on
  public.warehouse_areas,
  public.locations,
  public.pallets,
  public.move_transactions,
  public.inbound_receipts
to anon, authenticated;

-- Move Pallet performs its write through the move_pallet RPC.
grant execute on function public.move_pallet(jsonb) to anon, authenticated;
