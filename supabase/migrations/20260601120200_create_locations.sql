create table if not exists public.locations (
  id text primary key default gen_random_uuid()::text,
  area_id text not null references public.warehouse_areas(id) on delete restrict on update cascade,
  zone text not null,
  aisle text not null,
  bay text not null,
  level text not null,
  depth_position integer not null,
  full_location_code text not null unique,
  home_product_id integer references public.products(id) on delete set null on update cascade,
  is_front_home_slot boolean not null default false,
  is_flex_slot boolean not null default false,
  allows_overflow boolean not null default false,
  status text not null default 'OPEN' check (status in ('OPEN', 'OCCUPIED_HOME_SKU', 'OCCUPIED_OVERFLOW_SKU', 'RESERVED_HOME_SLOT', 'OPEN_FLEX_SLOT', 'BLOCKED')),
  part_number_start text,
  part_number_end text,
  travel_sequence integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locations_area_id_idx on public.locations (area_id);
create index if not exists locations_zone_aisle_bay_idx on public.locations (zone, aisle, bay);
create index if not exists locations_home_product_id_idx on public.locations (home_product_id);
create index if not exists locations_status_idx on public.locations (status);
create index if not exists locations_slot_rules_idx on public.locations (is_front_home_slot, is_flex_slot, allows_overflow);

drop trigger if exists set_locations_updated_at on public.locations;
create trigger set_locations_updated_at
before update on public.locations
for each row execute function public.set_updated_at();
