-- ============================================================================
-- Floor Map demo seed — realistic small warehouse for TBF Backstock Tracker
-- ============================================================================
-- Run AFTER seed-00-diagnostic.sql confirms layout tables are empty.
-- Idempotent-ish: wrap in a transaction; re-running requires the reset block
-- at the bottom first (commented out) to avoid unique-constraint collisions.
--
-- Design goals:
--   * 4 areas: Receiving, Front Home, Backstock, Overflow
--   * ~210 locations across realistic aisle/bay/depth grids
--   * Pallets placed to exercise EVERY triage state the redesign surfaces:
--       - occupied home SKU (green)
--       - overflow occupied (amber)  -> lights the amber metric card
--       - blocked (red)              -> lights the red metric card
--       - open / open-flex (dashed)
--   * Single-SKU pallets only (one pallet = one product_id). Mixed clothing/
--     accessory pallets are a known limitation logged for later schema work.
--   * All SKU references resolved from products.item_code at runtime, so this
--     works against whatever product set is actually loaded.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Areas
-- ---------------------------------------------------------------------------
insert into public.warehouse_areas (id, name, area_type, sort_order) values
  ('area-receiving', 'Receiving Dock',     'RECEIVING', 1),
  ('area-front-home','Front Home Pick',    'FRONT_HOME',2),
  ('area-backstock', 'Named Backstock',    'BACKSTOCK', 3),
  ('area-overflow',  'Temporary Overflow', 'OVERFLOW',  4)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Locations
--    Generated with generate_series so the grid is consistent.
--    Code format: <AREA>-<AISLE>-<BAY>-<DEPTH>, e.g. BK-03-12-2
-- ---------------------------------------------------------------------------

-- Front Home: aisles A1-A2, bays 1-6, single depth (front pick faces)
insert into public.locations
  (area_id, zone, aisle, bay, level, depth_position, full_location_code,
   is_front_home_slot, is_flex_slot, allows_overflow, status, travel_sequence)
select
  'area-front-home', 'FRONT', a::text, lpad(b::text,2,'0'), '1', 1,
  'FH-'||lpad(a::text,2,'0')||'-'||lpad(b::text,2,'0')||'-1',
  true, false, false, 'OPEN', (a*100 + b)
from generate_series(1,2) a, generate_series(1,6) b
on conflict (full_location_code) do nothing;

-- Backstock: aisles 1-4, bays 1-10, depth 1-3 (deep reserve)
insert into public.locations
  (area_id, zone, aisle, bay, level, depth_position, full_location_code,
   is_front_home_slot, is_flex_slot, allows_overflow, status, travel_sequence)
select
  'area-backstock', 'BACK', lpad(a::text,2,'0'), lpad(b::text,2,'0'), '1', d,
  'BK-'||lpad(a::text,2,'0')||'-'||lpad(b::text,2,'0')||'-'||d,
  false,
  (d = 3),                 -- deepest position is a flex slot
  (d >= 2),                -- depth 2+ allows overflow
  'OPEN',
  (1000 + a*100 + b*10 + d)
from generate_series(1,4) a, generate_series(1,10) b, generate_series(1,3) d
on conflict (full_location_code) do nothing;

-- Overflow: aisle 9, bays 1-8, depth 1-2 (temporary)
insert into public.locations
  (area_id, zone, aisle, bay, level, depth_position, full_location_code,
   is_front_home_slot, is_flex_slot, allows_overflow, status, travel_sequence)
select
  'area-overflow', 'OVFL', '09', lpad(b::text,2,'0'), '1', d,
  'OV-09-'||lpad(b::text,2,'0')||'-'||d,
  false, false, true, 'OPEN', (9000 + b*10 + d)
from generate_series(1,8) b, generate_series(1,2) d
on conflict (full_location_code) do nothing;

-- Receiving: aisle R, bays 1-4, staging
insert into public.locations
  (area_id, zone, aisle, bay, level, depth_position, full_location_code,
   is_front_home_slot, is_flex_slot, allows_overflow, status, travel_sequence)
select
  'area-receiving', 'RECV', 'R', lpad(b::text,2,'0'), '1', 1,
  'RC-R-'||lpad(b::text,2,'0')||'-1',
  false, false, false, 'OPEN', b
from generate_series(1,4) b
on conflict (full_location_code) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Assign home SKUs to front-home + backstock-front locations
--    Pick real 8" SKUs for one aisle band, 16" SKUs for another, by item_code.
-- ---------------------------------------------------------------------------
with eights as (
  select id, item_code,
         row_number() over (order by item_code) as rn
  from public.products
  where item_code ~ '^5'           -- 8" plush item codes start with 5
), sixteens as (
  select id, item_code,
         row_number() over (order by item_code) as rn
  from public.products
  where item_code ~ '^(57|6)'      -- 16" plush start with 57/6
),
-- front-home + backstock depth-1 slots get a home SKU
home_slots as (
  select id, full_location_code,
         row_number() over (order by travel_sequence) as rn,
         (aisle::text in ('1','01','2','02')) as is_eight_band
  from public.locations
  where (is_front_home_slot = true)
     or (area_id = 'area-backstock' and depth_position = 1)
)
update public.locations l
set home_product_id = coalesce(
      (select e.id from eights e   where e.rn = ((hs.rn - 1) % (select count(*) from eights)) + 1),
      (select s.id from sixteens s where s.rn = ((hs.rn - 1) % (select count(*) from sixteens)) + 1)
    )
from home_slots hs
where l.id = hs.id;

-- ---------------------------------------------------------------------------
-- 4. Pallets — place a realistic mix and set location statuses to match.
-- ---------------------------------------------------------------------------

-- 4a. Occupied home SKU: fill ~60% of backstock depth-1 home slots with their
--     own home SKU. -> status OCCUPIED_HOME_SKU (green dots).
with target as (
  select l.id as location_id, l.home_product_id,
         row_number() over (order by l.travel_sequence) as rn
  from public.locations l
  where l.area_id = 'area-backstock'
    and l.depth_position = 1
    and l.home_product_id is not null
)
insert into public.pallets (pallet_license_plate, product_id, quantity, received_at, current_location_id, status)
select
  'LP-'||lpad(t.rn::text,5,'0'),
  t.home_product_id,
  (40 + (t.rn % 5) * 5),                          -- 40-60 units
  now() - ((t.rn % 30) || ' days')::interval,
  t.location_id,
  'AVAILABLE'
from target t
where t.rn % 5 <> 0;                              -- skip every 5th -> stays OPEN

update public.locations l
set status = 'OCCUPIED_HOME_SKU'
where exists (select 1 from public.pallets p where p.current_location_id = l.id)
  and l.area_id = 'area-backstock';

-- 4b. Overflow occupied: put pallets of HIGH-velocity 16" SKUs into overflow
--     bays (no home there) -> OCCUPIED_OVERFLOW_SKU (amber). Lights amber card.
with ov as (
  select l.id as location_id, row_number() over (order by l.travel_sequence) as rn
  from public.locations l
  where l.area_id = 'area-overflow'
), sixteens as (
  select id, row_number() over (order by item_code) as rn
  from public.products where item_code ~ '^(57|6)'
)
insert into public.pallets (pallet_license_plate, product_id, quantity, received_at, current_location_id, status)
select
  'LP-OV'||lpad(ov.rn::text,4,'0'),
  (select s.id from sixteens s where s.rn = ((ov.rn - 1) % (select count(*) from sixteens)) + 1),
  (30 + (ov.rn % 4) * 10),
  now() - ((ov.rn % 10) || ' days')::interval,
  ov.location_id,
  'AVAILABLE'
from ov
where ov.rn <= 6;                                 -- 6 overflow pallets

update public.locations l
set status = 'OCCUPIED_OVERFLOW_SKU'
where l.area_id = 'area-overflow'
  and exists (select 1 from public.pallets p where p.current_location_id = l.id);

-- 4c. Blocked: mark 3 locations blocked (damage / aisle obstruction). Red card.
update public.locations
set status = 'BLOCKED'
where full_location_code in ('BK-02-05-2', 'BK-03-08-1', 'OV-09-07-1');

-- 4d. Front-home occupied: fill front pick faces with their home SKU.
with fh as (
  select l.id as location_id, l.home_product_id,
         row_number() over (order by l.travel_sequence) as rn
  from public.locations l
  where l.is_front_home_slot = true and l.home_product_id is not null
)
insert into public.pallets (pallet_license_plate, product_id, quantity, received_at, current_location_id, status)
select
  'LP-FH'||lpad(fh.rn::text,4,'0'),
  fh.home_product_id,
  (20 + (fh.rn % 3) * 5),
  now() - ((fh.rn % 7) || ' days')::interval,
  fh.location_id,
  'AVAILABLE'
from fh
where fh.rn % 3 <> 0;                             -- leave some front faces open

update public.locations l
set status = 'OCCUPIED_HOME_SKU'
where l.is_front_home_slot = true
  and exists (select 1 from public.pallets p where p.current_location_id = l.id);

-- 4e. Mark deep flex slots that allow overflow but sit empty as OPEN_FLEX_SLOT.
update public.locations l
set status = 'OPEN_FLEX_SLOT'
where l.is_flex_slot = true
  and l.status = 'OPEN'
  and not exists (select 1 from public.pallets p where p.current_location_id = l.id);

commit;

-- ---------------------------------------------------------------------------
-- Post-seed sanity (run separately if you like):
-- ---------------------------------------------------------------------------
-- select status, count(*) from public.locations group by status order by status;
-- select count(*) as pallets from public.pallets;

-- ===========================================================================
-- RESET (uncomment to wipe layout + pallets before re-seeding):
-- ===========================================================================
-- begin;
--   delete from public.move_transactions;
--   delete from public.pallets;
--   delete from public.locations;
--   delete from public.warehouse_areas;
-- commit;
