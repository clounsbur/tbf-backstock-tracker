create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.warehouse_areas (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  area_type text not null check (area_type in ('FRONT_HOME', 'BACKSTOCK', 'FLEX_RESERVE', 'OVERFLOW', 'RECEIVING')),
  sort_order integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists warehouse_areas_area_type_idx on public.warehouse_areas (area_type);

drop trigger if exists set_warehouse_areas_updated_at on public.warehouse_areas;
create trigger set_warehouse_areas_updated_at
before update on public.warehouse_areas
for each row execute function public.set_updated_at();
