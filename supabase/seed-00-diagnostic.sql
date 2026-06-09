-- Diagnostic: run this in the Supabase SQL editor first.
-- Tells us whether warehouse layout already exists before we seed pallets.

select 'products'        as table_name, count(*) as rows from public.products
union all
select 'warehouse_areas', count(*) from public.warehouse_areas
union all
select 'locations',       count(*) from public.locations
union all
select 'pallets',         count(*) from public.pallets
union all
select 'inbound_receipts',count(*) from public.inbound_receipts
union all
select 'move_transactions',count(*) from public.move_transactions
order by table_name;

-- Sanity check: do we have item_codes to reference? (should be ~179)
select count(*) as products_with_item_code
from public.products
where item_code is not null and item_code <> '';
