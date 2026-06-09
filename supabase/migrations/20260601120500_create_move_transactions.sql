create table if not exists public.move_transactions (
  id text primary key default gen_random_uuid()::text,
  pallet_id text not null references public.pallets(id) on delete restrict on update cascade,
  product_id integer not null references public.products(id) on delete restrict on update cascade,
  from_location_id text references public.locations(id) on delete set null on update cascade,
  to_location_id text references public.locations(id) on delete set null on update cascade,
  moved_by text not null,
  moved_at timestamptz not null default now(),
  reason_code text not null check (reason_code in ('STANDARD_MOVE', 'INBOUND_PUTAWAY', 'OVERFLOW_RELOCATION', 'RECLAIM_HOME_SLOT', 'CONSOLIDATION', 'ADJUSTMENT')),
  notes text
);

create index if not exists move_transactions_pallet_id_idx on public.move_transactions (pallet_id);
create index if not exists move_transactions_product_id_idx on public.move_transactions (product_id);
create index if not exists move_transactions_moved_at_idx on public.move_transactions (moved_at);
create index if not exists move_transactions_from_location_id_idx on public.move_transactions (from_location_id);
create index if not exists move_transactions_to_location_id_idx on public.move_transactions (to_location_id);
