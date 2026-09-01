-- ============================================================================
-- The Session-12 grant gave only SELECT on the inventory tables. The new
-- client-side flows (container putaway, release-to-picking, future moves) do
-- direct INSERT/UPDATE/DELETE, so grant the needed write privileges.
-- NOTE: broad dev-time grants — tighten to per-role RLS before production.
-- ============================================================================
begin;

-- pallets: insert (putaway), update (release / move), delete (corrections)
grant insert, update, delete on public.pallets to anon, authenticated;

-- locations: update status (occupy / open)
grant update on public.locations to anon, authenticated;

-- move_transactions: insert (log every move/putaway/release)
grant insert on public.move_transactions to anon, authenticated;

-- inbound_receipts: insert/update for future receipt records
grant insert, update on public.inbound_receipts to anon, authenticated;

-- ensure sequence usage if any of these use sequences (pallets/locations use text PKs,
-- but grant broadly to be safe for any serial columns)
grant usage, select on all sequences in schema public to anon, authenticated;

commit;
