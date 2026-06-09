-- ============================================================================
-- backstock_routing: family + item-code range -> eligible backstock area.
-- The container putaway assigner ranks a family's eligible areas by LIVE open-slot
-- capacity (most room first) at assign time; `rank` is only a tiebreak / intent record.
-- Whitefish is NOT listed here — it is the GLOBAL last resort, handled in code:
-- used only when a SKU's family areas AND all other non-Whitefish areas are full.
-- Families: fiber, accessories, plush8, plush16_lower (<=60725), plush16_upper (>60725), clothing.
-- (Mackinac was merged into Michigan = area-mic.)
-- ============================================================================
begin;

create table if not exists public.backstock_routing (
  id              text primary key default gen_random_uuid()::text,
  family          text not null check (family in ('fiber','accessories','plush8','plush16_lower','plush16_upper','clothing')),
  item_code_min   text,
  item_code_max   text,
  backstock_area_id text not null references public.warehouse_areas(id) on delete cascade,
  rank            integer not null,
  created_at      timestamptz not null default now()
);
create index if not exists backstock_routing_family_idx on public.backstock_routing (family);

delete from public.backstock_routing;

insert into public.backstock_routing (family, item_code_min, item_code_max, backstock_area_id, rank) values
  ('fiber',null,null,'area-ont',1),
  ('fiber',null,null,'area-soo',2),
  ('fiber',null,null,'area-sup',3),
  ('accessories',null,null,'area-sup',1),
  ('plush16_lower','00000','60725','area-mic',1),
  ('plush16_lower','00000','60725','area-hur',2),
  ('plush16_upper','60726','99999','area-sup',1),
  ('plush8','50000','50999','area-mic',1),
  ('plush8','50000','50999','area-hur',2),
  ('clothing',null,null,'area-eri',1),
  ('clothing',null,null,'area-hur',2);

grant select on public.backstock_routing to anon, authenticated;

commit;

-- sanity:
-- select r.family, w.name, r.rank from backstock_routing r
--   join warehouse_areas w on w.id=r.backstock_area_id order by r.family, r.rank;
