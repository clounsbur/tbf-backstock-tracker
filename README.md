# Warehouse Backstock Tracker

Internal warehouse MVP for mapping inventory to floor locations, moving pallets with
validated destinations, and getting smart placement suggestions for inbound product.
Prioritizes designated/named backstock areas over temporary overflow, and permanently
reserves each SKU's front "home" pick slot.

## Architecture

React (Vite) single-page app that talks **directly to Supabase** using the anon key —
there is no Express/API server. Reads are plain `supabase-js` queries; pallet moves and
new-location/area setup go through Postgres RPCs (`move_pallet`, `create_location`,
`create_warehouse_area`) that do the rule-checked writes atomically.

This app has its own dedicated Supabase project (**TBF Backstock Tracker**), separate
from the Bear Factory mobile app's database. The only thing it shares conceptually with
that app is the WooCommerce product catalog, and that's kept in sync independently (see
below) rather than by pointing at the other app's database — this app's `products` table
only carries the fields it actually needs (identity, description, pickability, the
inventory-routing fields, and its own `barcode` column), not pricing/tariff/shipping data.

- `client/src/api/client.ts` — the one module that owns the Supabase client and all
  queries/mutations/business logic (placement scoring, move validation, mappers). Every
  screen calls into this file.
- `client/src/screens/` — `FloorPlan` (default route), `FloorMap`, `InboundContainer`,
  `InboundSuggestions`, `MovePallet`, `ReleaseToPicking`, `SkuSearch`, `AddLocation`.
- `supabase/migrations/` — SQL migrations for the schema (`products`, `warehouse_areas`,
  `locations`, `pallets`, `move_transactions`, `inbound_receipts`, `backstock_routing`)
  and the RPCs.
- `supabase/functions/woo-product-sync/` — a Supabase Edge Function that receives a
  WooCommerce webhook on product create/update and upserts `item_code`/`description`/
  `is_pickable` into this project's own `products` table. Verifies WooCommerce's
  HMAC signature against the `WC_WEBHOOK_SECRET` function secret. Barcodes are seeded
  separately (see `sku-family-assignment*.xlsx` / the barcode export) and are not part
  of this sync — they're this app's own data.

## Setup

1. Apply the migrations in `supabase/migrations/` to a Supabase project.
2. Create `.env` at the repo root with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Deploy the product-sync function and set its secret:
   ```bash
   supabase functions deploy woo-product-sync --use-api --no-verify-jwt
   supabase secrets set WC_WEBHOOK_SECRET="<generate a random secret>"
   ```
5. In WooCommerce (Settings → Advanced → Webhooks), add webhooks for "Product created"
   and "Product updated" pointing at
   `https://<project-ref>.supabase.co/functions/v1/woo-product-sync`, using the same
   secret from step 4.

Supabase anon-key grants are broad dev-time read/write grants on the inventory tables.
Tighten with per-role RLS before this goes anywhere near production.

**Note:** this project's "Data API" toggle (Project Settings → API → Enable Data API)
must be on, or every REST/RPC call fails with a schema-cache error even though direct
SQL access still works fine — easy to miss since the failure looks unrelated.

## Running locally

```bash
npm run dev
```

Frontend: `http://127.0.0.1:5173`

```bash
npm run build
```

Builds the frontend to `dist-client/`.

## Planning docs

- [warehouse_inventory_mapping_app_spec.md](warehouse_inventory_mapping_app_spec.md) — original product spec
- [floor-map-redesign-plan.md](floor-map-redesign-plan.md) — done
- [named-backstock-proximity-plan.md](named-backstock-proximity-plan.md) — done (area set has grown since this was written)
- [interactive-area-map-plan.md](interactive-area-map-plan.md) — partially built (2D drill-in + batch release done; 2.5D lane view, long-press-to-move, place-into-empty-slot not started)
- [PARKING-LOT-mixed-pallets.md](PARKING-LOT-mixed-pallets.md) — deferred, not started
