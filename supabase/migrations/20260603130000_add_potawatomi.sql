-- ============================================================================
-- Phase 0b: add Potawatomi (9th area) + is_floor_stacked flag.
-- Additive — does not modify the 493 existing locations.
-- ============================================================================
begin;

-- 1. Floor-stacked flag (depth is not a reliable proxy — Potawatomi is depth-1 but floor-stacked)
alter table public.warehouse_areas add column if not exists is_floor_stacked boolean not null default false;

update public.warehouse_areas set is_floor_stacked = true
where name in ('Mackinac','Ontario','Soo Locks','Whitefish','Potawatomi');

-- 2. Potawatomi area: 25 bays x (1 wide x 2 high) x depth 1 = 50 floor-stack positions
insert into public.warehouse_areas (id,name,area_type,sort_order,is_last_resort,is_floor_stacked) values
  ('area-pot','Potawatomi','BACKSTOCK',11,false,true)
on conflict (id) do nothing;

-- 3. Potawatomi locations
insert into public.locations (area_id,zone,aisle,bay,level,depth_position,full_location_code,is_shortened_height,slot_row,slot_col,allows_overflow,is_flex_slot,status) values
  ('area-pot','POT','1','1','1',1,'POT-01-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','1','2',1,'POT-01-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','2','1',1,'POT-02-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','2','2',1,'POT-02-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','3','1',1,'POT-03-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','3','2',1,'POT-03-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','4','1',1,'POT-04-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','4','2',1,'POT-04-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','5','1',1,'POT-05-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','5','2',1,'POT-05-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','6','1',1,'POT-06-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','6','2',1,'POT-06-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','7','1',1,'POT-07-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','7','2',1,'POT-07-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','8','1',1,'POT-08-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','8','2',1,'POT-08-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','9','1',1,'POT-09-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','9','2',1,'POT-09-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','10','1',1,'POT-10-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','10','2',1,'POT-10-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','11','1',1,'POT-11-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','11','2',1,'POT-11-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','12','1',1,'POT-12-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','12','2',1,'POT-12-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','13','1',1,'POT-13-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','13','2',1,'POT-13-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','14','1',1,'POT-14-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','14','2',1,'POT-14-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','15','1',1,'POT-15-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','15','2',1,'POT-15-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','16','1',1,'POT-16-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','16','2',1,'POT-16-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','17','1',1,'POT-17-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','17','2',1,'POT-17-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','18','1',1,'POT-18-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','18','2',1,'POT-18-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','19','1',1,'POT-19-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','19','2',1,'POT-19-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','20','1',1,'POT-20-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','20','2',1,'POT-20-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','21','1',1,'POT-21-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','21','2',1,'POT-21-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','22','1',1,'POT-22-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','22','2',1,'POT-22-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','23','1',1,'POT-23-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','23','2',1,'POT-23-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','24','1',1,'POT-24-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','24','2',1,'POT-24-2',false,2,1,false,false,'OPEN'),
  ('area-pot','POT','1','25','1',1,'POT-25-1',false,1,1,false,false,'OPEN'),
  ('area-pot','POT','1','25','2',1,'POT-25-2',false,2,1,false,false,'OPEN');

commit;

-- sanity: select name,count(*) from locations l join warehouse_areas w on l.area_id=w.id group by name,w.sort_order order by w.sort_order;