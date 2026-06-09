create table if not exists public.inbound_receipts (
  id text primary key default gen_random_uuid()::text,
  product_id integer not null references public.products(id) on delete restrict on update cascade,
  pallet_qty integer not null,
  received_by text not null,
  received_at timestamptz not null default now(),
  status text not null default 'OPEN' check (status in ('OPEN', 'PARTIALLY_PLACED', 'PLACED', 'CANCELLED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inbound_receipts_product_id_idx on public.inbound_receipts (product_id);
create index if not exists inbound_receipts_status_idx on public.inbound_receipts (status);
create index if not exists inbound_receipts_received_at_idx on public.inbound_receipts (received_at);

drop trigger if exists set_inbound_receipts_updated_at on public.inbound_receipts;
create trigger set_inbound_receipts_updated_at
before update on public.inbound_receipts
for each row execute function public.set_updated_at();
