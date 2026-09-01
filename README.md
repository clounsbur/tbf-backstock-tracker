# Warehouse Backstock Tracker

Internal warehouse MVP for mapping inventory to floor locations, moving pallets with
validated destinations, and getting smart placement suggestions for inbound product.
Prioritizes designated/named backstock areas over temporary overflow, and permanently
reserves each SKU's front "home" pick slot.

## Architecture

React (Vite) single-page app that talks **directly to Supabase** using the anon key —
there is no Express/API server. Reads are plain `supabase-js` queries; pallet moves go
through a single Postgres RPC, `move_pallet(input jsonb)`, which does the rule-checked
move atomically.

- `client/src/api/client.ts` — the one module that owns the Supabase client and all
  queries/mutations/business logic (placement scoring, move validation, mappers). Every
  screen calls into this file.
- `client/src/screens/` — `FloorPlan` (default route), `FloorMap`, `InboundContainer`,
  `InboundSuggestions`, `MovePallet`, `ReleaseToPicking`, `SkuSearch`.
- `supabase/` — SQL migrations and seed data for the schema (`products`,
  `warehouse_areas`, `locations`, `pallets`, `move_transactions`, `inbound_receipts`,
  `backstock_routing`).
- `src/services/*.ts`, `src/domainTypes.ts` — **currently dead code.** This was an
  earlier Express/Prisma backend layer; the server was removed but these files were
  left behind and nothing imports them anymore. `npm test` only exercises this unused
  code, not the logic actually running in the browser (`client.ts`). Slated for
  reconciliation or removal — see [DEV-WARNINGS.md](DEV-WARNINGS.md).

## Setup

1. Create a Supabase project and apply the migrations in `supabase/migrations/`.
2. Create `.env` at the repo root with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

Supabase anon-key grants are broad dev-time read/write grants on the inventory tables.
Tighten with per-role RLS before this goes anywhere near production.

## Running locally

```bash
npm run dev
```

Frontend: `http://127.0.0.1:5173`

```bash
npm run build
```

Builds the frontend to `dist-client/`. (`build:services` also runs `tsc` over the dead
`src/` layer — see note above.)

## Planning docs

- [warehouse_inventory_mapping_app_spec.md](warehouse_inventory_mapping_app_spec.md) — original product spec
- [floor-map-redesign-plan.md](floor-map-redesign-plan.md) — done
- [named-backstock-proximity-plan.md](named-backstock-proximity-plan.md) — done (area set has grown since this was written)
- [interactive-area-map-plan.md](interactive-area-map-plan.md) — partially built (2D drill-in + batch release done; 2.5D lane view, long-press-to-move, place-into-empty-slot not started)
- [PARKING-LOT-mixed-pallets.md](PARKING-LOT-mixed-pallets.md) — deferred, not started
