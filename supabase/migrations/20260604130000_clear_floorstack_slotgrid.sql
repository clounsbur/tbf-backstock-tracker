-- ============================================================================
-- Floor-stacked locations should not carry a 2D slot grid (slot_row/slot_col).
-- Potawatomi's seed set them by mistake, causing the Floor Plan to render it as
-- a rack grid instead of top/bottom floor stacks. Null them out on every
-- floor-stacked area so the per-bay renderer treats them as stacks.
-- (Racking areas — Superior, Huron, Erie, and Michigan bays 1-2 — keep their grid.)
-- ============================================================================
begin;

-- Clear slot grid on floor-stacked locations, but PRESERVE Michigan's rack
-- bays 1-2 (Michigan is a mixed area: bays 1-2 are racks, 3-15 are floor).
update public.locations l
set slot_row = null, slot_col = null
from public.warehouse_areas w
where w.id = l.area_id
  and w.is_floor_stacked = true
  and not (w.name = 'Michigan' and l.bay in ('1', '2'));

commit;

-- sanity: floor-stacked areas should now have 0 rows with slot_row not null
-- select w.name, count(*) filter (where l.slot_row is not null) as gridded
-- from locations l join warehouse_areas w on w.id=l.area_id
-- where w.is_floor_stacked group by w.name;
