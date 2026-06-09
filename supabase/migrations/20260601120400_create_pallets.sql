create table if not exists public.pallets (
  id text primary key default gen_random_uuid()::text,
  pallet_license_plate text not null unique,
  product_id integer not null references public.products(id) on delete restrict on update cascade,
  quantity integer not null,
  received_at timestamptz not null,
  current_location_id text unique references public.locations(id) on delete set null on update cascade,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'IN_TRANSIT', 'CONSUMED', 'HOLD')),
  inbound_receipt_id text references public.inbound_receipts(id) on delete set null on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pallets_product_id_idx on public.pallets (product_id);
create index if not exists pallets_current_location_id_idx on public.pallets (current_location_id);
create index if not exists pallets_status_idx on public.pallets (status);

drop trigger if exists set_pallets_updated_at on public.pallets;
create trigger set_pallets_updated_at
before update on public.pallets
for each row execute function public.set_updated_at();
