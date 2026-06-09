-- ============================================================================
-- Phase 0c: Merge region into a single Michigan (bays 1-15); drop Mackinac.
-- Michigan now mixed-depth: bays 1-2 racking depth-1, 3-11 floor depth-3,
-- 12-15 floor depth-2. Mackinac name removed.
-- ============================================================================
begin;

-- 1. Drop Mackinac's locations + any pallets on them, then the area.
delete from public.pallets where current_location_id in
  (select id from public.locations where area_id = 'area-mac');
delete from public.locations where area_id = 'area-mac';
delete from public.warehouse_areas where id = 'area-mac';

-- 2. Michigan is now (partly) floor-stacked.
update public.warehouse_areas set is_floor_stacked = true where id = 'area-mic';

-- 3. Add Michigan bays 3-15 (former Mackinac region + new bays 12-15).
insert into public.locations (area_id,zone,aisle,bay,level,depth_position,full_location_code,is_shortened_height,slot_row,slot_col,allows_overflow,is_flex_slot,status) values
  ('area-mic','MIC','1','3','1',1,'MIC-03-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','3','1',2,'MIC-03-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','3','1',3,'MIC-03-1-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','3','2',1,'MIC-03-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','3','2',2,'MIC-03-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','3','2',3,'MIC-03-2-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','4','1',1,'MIC-04-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','4','1',2,'MIC-04-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','4','1',3,'MIC-04-1-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','4','2',1,'MIC-04-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','4','2',2,'MIC-04-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','4','2',3,'MIC-04-2-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','5','1',1,'MIC-05-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','5','1',2,'MIC-05-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','5','1',3,'MIC-05-1-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','5','2',1,'MIC-05-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','5','2',2,'MIC-05-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','5','2',3,'MIC-05-2-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','6','1',1,'MIC-06-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','6','1',2,'MIC-06-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','6','1',3,'MIC-06-1-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','6','2',1,'MIC-06-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','6','2',2,'MIC-06-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','6','2',3,'MIC-06-2-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','7','1',1,'MIC-07-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','7','1',2,'MIC-07-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','7','1',3,'MIC-07-1-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','7','2',1,'MIC-07-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','7','2',2,'MIC-07-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','7','2',3,'MIC-07-2-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','8','1',1,'MIC-08-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','8','1',2,'MIC-08-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','8','1',3,'MIC-08-1-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','8','2',1,'MIC-08-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','8','2',2,'MIC-08-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','8','2',3,'MIC-08-2-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','9','1',1,'MIC-09-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','9','1',2,'MIC-09-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','9','1',3,'MIC-09-1-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','9','2',1,'MIC-09-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','9','2',2,'MIC-09-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','9','2',3,'MIC-09-2-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','10','1',1,'MIC-10-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','10','1',2,'MIC-10-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','10','1',3,'MIC-10-1-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','10','2',1,'MIC-10-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','10','2',2,'MIC-10-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','10','2',3,'MIC-10-2-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','11','1',1,'MIC-11-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','11','1',2,'MIC-11-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','11','1',3,'MIC-11-1-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','11','2',1,'MIC-11-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','11','2',2,'MIC-11-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','11','2',3,'MIC-11-2-D3',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','12','1',1,'MIC-12-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','12','1',2,'MIC-12-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','12','2',1,'MIC-12-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','12','2',2,'MIC-12-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','13','1',1,'MIC-13-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','13','1',2,'MIC-13-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','13','2',1,'MIC-13-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','13','2',2,'MIC-13-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','14','1',1,'MIC-14-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','14','1',2,'MIC-14-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','14','2',1,'MIC-14-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','14','2',2,'MIC-14-2-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','15','1',1,'MIC-15-1-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','15','1',2,'MIC-15-1-D2',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','15','2',1,'MIC-15-2-D1',false,null,null,false,false,'OPEN'),
  ('area-mic','MIC','1','15','2',2,'MIC-15-2-D2',false,null,null,false,false,'OPEN');

commit;

-- sanity: select w.name, count(*) from locations l join warehouse_areas w on w.id=l.area_id group by w.name,w.sort_order order by w.sort_order;