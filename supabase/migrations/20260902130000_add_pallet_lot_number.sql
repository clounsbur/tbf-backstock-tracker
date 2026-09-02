-- Lot/batch number varies per physical pallet, not per SKU (two pallets of
-- the same item can come from different production runs) -- products.lot_number
-- already exists but is the wrong granularity for this. Add it to pallets.

alter table public.pallets add column if not exists lot_number text;
