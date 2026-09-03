# Parking Lot — Possible Future Features

A running list of feature ideas raised during development that aren't being
built right now. Add a short entry here whenever an idea comes up and gets
deferred; if it grows enough to need real design notes (schema changes,
affected screens, etc.), give it its own `PARKING-LOT-<topic>.md` file like
[PARKING-LOT-mixed-pallets.md](PARKING-LOT-mixed-pallets.md) and just link to
it from here.

## Open ideas

### WooCommerce price sync -> floor inventory value
**Logged:** 2026-09-03

Bring `price` in through the existing `woo-product-sync` webhook — WooCommerce
already sends it in the payload, the sync function just isn't capturing it
(`supabase/functions/woo-product-sync/index.ts`). Add a `price` column to
`products`, read it in the webhook handler, then surface a "value of goods on
the floor" stat: sum of `pallet.quantity x sku.price` across every currently
placed pallet — likely a new stat next to Floor Map's existing location
counts.

Caveat: this is WooCommerce's *selling* price, not cost basis. Fine for a
replacement-value framing, but not true inventory valuation unless a cost
field gets added later too.

### Mixed-SKU pallet support
See [PARKING-LOT-mixed-pallets.md](PARKING-LOT-mixed-pallets.md) — clothing
and accessory pallets can carry multiple SKUs, which the current
one-pallet-one-SKU schema can't represent.
