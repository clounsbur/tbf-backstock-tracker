# Parking lot — mixed-SKU pallet support

**Logged:** Session 12 (Floor Map redesign + demo seed)
**Status:** Deferred — needs a schema design pass before building.

## The limitation

The current schema models one pallet as exactly one SKU:

```
pallets.product_id  integer not null references products(id)
pallets.current_location_id  text unique references locations(id)
```

Two consequences:

1. A single pallet row cannot hold more than one SKU.
2. `current_location_id` is **unique**, so a location holds at most one pallet.

This is fine for plush, where Casey's rule is "all pallets of plush are one SKU." But **clothing and accessory pallets can be mixed** — one physical pallet may carry several outfit/accessory SKUs. There is no way to represent that today without faking it (e.g. duplicate pallet rows sharing a license-plate prefix, which the unique location constraint blocks anyway).

For the demo seed we used **single-SKU pallets only** (one dominant SKU per pallet). Mixed contents are a real-world note, not modeled.

## Proposed direction (when picked up)

Introduce a `pallet_contents` child table so a pallet is a container and SKUs are line items:

```sql
create table public.pallet_contents (
  id            text primary key default gen_random_uuid()::text,
  pallet_id     text not null references public.pallets(id) on delete cascade,
  product_id    integer not null references public.products(id),
  quantity      integer not null,
  lot_number    text,
  created_at    timestamptz not null default now()
);
```

Then:
- Make `pallets.product_id` nullable (or drop it) — a mixed pallet has no single product.
- Add `pallets.is_mixed boolean` for fast filtering / UI badging.
- Update `listPallets` / `listLocations` selects to join `pallet_contents`.
- SKU Search and Move Pallet need to handle "pallet contains SKU X" rather than "pallet IS SKU X."
- Floor Map tile: a mixed pallet shows "Mixed (N SKUs)" instead of a single part number.

## Affected code
- `client/src/api/client.ts` — `Pallet` type, `mapPallet`, `listPallets`, `searchSkus`, `getMoveDestinations`.
- `client/src/screens/SkuSearch.tsx`, `MovePallet.tsx`, `FloorMap.tsx` (tile status line).
- `move_pallet` RPC — moving a mixed pallet should move all its contents together (already true, since it moves the pallet row).

## Why deferred
Touches the type model and three screens; not needed to validate the Floor Map redesign. Single-SKU seed exercises every UI state already.
