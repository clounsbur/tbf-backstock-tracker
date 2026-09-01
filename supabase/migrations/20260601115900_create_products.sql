-- This app's own slim product catalog. Deliberately independent from the
-- Bear Factory mobile app's `products` table (in the TBF Mobile Web APP
-- project), which carries pricing, tariff, and shipping fields this app has
-- no business touching. Only the fields the warehouse app actually needs:
-- identity/description, the inventory-routing fields, and a barcode kept
-- solely for this app's own use.

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

create table if not exists public.products (
  id serial primary key,
  item_code text not null unique,
  description text not null,
  is_pickable boolean not null default true,
  velocity_class text check (velocity_class is null or velocity_class in ('FAST', 'MEDIUM', 'SLOW')),
  product_family text,
  pallets_per_full_allocation integer,
  lot_number text,
  barcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_item_code_idx on public.products (item_code);
create index if not exists products_product_family_idx on public.products (product_family);

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();
