alter table public.products
  add column if not exists velocity_class text check (velocity_class is null or velocity_class in ('FAST', 'MEDIUM', 'SLOW')),
  add column if not exists product_family text,
  add column if not exists pallets_per_full_allocation integer,
  add column if not exists lot_number text;

create index if not exists products_velocity_class_idx on public.products (velocity_class);
create index if not exists products_product_family_idx on public.products (product_family);
