# Interactive area map (2D + 2.5D) — BUILD PLAN

**Status:** Plan only. Design settled Session 12 via mockup (`backstock_area_map_interaction_v2`).
**Goal:** Tap an area on the floor map → drill into a per-area view → move / add / delete pallets by touch. Built on existing data (`bay`/`level`/`depth_position`) and the existing `move_pallet` RPC.

---

## Feasibility (short version)

High. The hard backend already exists:
- `locations` stores `bay`, `level` (= slot), `depth_position` (= depth) — a coordinate system.
- `move_pallet` RPC already performs atomic, rule-checked moves.
- The redesigned Floor Map already groups by area and color-codes status.

The new work is a **visualization + interaction layer**, plus a small area-split and two columns. No 3D engine needed — a 2D top-down for depth-1 areas and a 2.5D lane side-view for deep areas covers it.

---

## Decisions locked (Session 12)

1. **Two renderers, chosen by area depth:**
   - **2D top-down** for depth-1 areas (Superior, Michigan, Huron, Erie): bays across, slots down.
   - **2.5D lane side-view** for depth>1 areas (Mackinac, Ontario, Soo Locks, Whitefish): each lane drawn as a front→back depth track.
2. **No LIFO.** Every depth position is independently accessible. Both renderers use the same interaction: tap a pallet to select, tap any open position to move. No front-only constraint.
3. **Michigan splits into two uniform-depth areas:**
   - **Michigan** — bays 1–2, depth 1 (2D).
   - **Mackinac** — bays 3–11, depth 3 (2.5D). New lake name for the deep section.
   This makes every area uniform-depth, so each renderer handles one depth model.
4. **Tap-to-move calls `move_pallet`** — same RPC, same rule checks already in `classifyMoveDestination`.
5. **Add / delete pallets** from the area view (new lightweight actions — see Phase 4).

---

## Schema additions

```sql
alter table public.locations
  add column if not exists is_shortened_height boolean not null default false;

alter table public.warehouse_areas
  add column if not exists is_last_resort boolean not null default false;  -- Whitefish
```

- `is_shortened_height` — the per-slot height-capacity flags from the layout CSV (e.g. Superior 10-1, 17-1). Rendered as a small "↧" marker on the cell; can later gate tall pallets out of these slots.
- `is_last_resort` — marks Whitefish for the scorer (below routed areas, above temp overflow). Shared with the named-backstock routing work.
- Bays are non-uniform (slot counts and, pre-split, depth varied) — handled in seed logic, no column needed.

---

## Phased build

### Phase 0 — area split + schema (migration)
- Split Michigan → Michigan (bays 1–2) + Mackinac (bays 3–11). Reassign those locations' `area_id`.
- Add the two columns above; set `is_shortened_height` on flagged slots; set `is_last_resort` on Whitefish.
- (Folds into the named-backstock migration — same pass.)

### Phase 1 — 2D top-down renderer (read-only)
- New route/screen: tap an area on the Floor Map → area detail.
- **A bay is a 2D pallet-rack grid, not a single column.** Every bay is one of exactly
  **two shapes: 2×3 (6 slots, default) or 3×3 (9 slots).** No other shapes exist. Slots
  number **top-down, left-right** (slot 1 = top-left, slot 2 = top-right). Confirmed from
  Casey's rack photo + follow-up.
- **Physical slots vs. usable capacity.** A bay always has its full 6 or 9 *physical*
  positions. The earlier CSV "4 slots / 5 slots" numbers were **usable** capacity, not
  shape — a 2×3 bay with 1–2 positions flagged unusable. So shortened-height and reduced
  capacity are the same mechanism: a full 2×3/3×3 bay where specific positions carry a
  flag. Always seed the full grid; flag the constrained cells.
- **Schema add:** `locations.slot_row` + `locations.slot_col` (1-indexed within the bay),
  so the renderer draws the grid directly and `is_shortened_height` sits on the exact
  cell. Bay shape is implied by its max row/col (2×3 vs 3×3) — no separate dimensions
  table needed.
- **3×3 bays:** only Superior bay 16 confirmed so far; all other bays default 2×3. Casey
  to list any additional 3×3 bays per area.
- Render each bay as its 6- or 9-cell grid; color by status; show LP/SKU in occupied
  cells, "↧" on shortened-height (e.g. Superior bay 10 slot 2).
- **Multi-aisle areas** (Superior = 5 aisles, Huron = 2 aisles + end-cap bay 10 — see
  `named-backstock-proximity-plan.md` aisle table) render **one block per aisle, side by
  side**, matching Casey's floor diagram. Single-block areas render as one block. Group by
  `locations.aisle`. The renderer reads aisle + row/col from data, so it generalizes — no
  hardcoded per-area layout.
- Read-only first — just renders real data correctly.

**Remaining bay input:** the per-area list of which bays are 3×3 (vs. default 2×3), and
which specific slots are flagged (shortened-height / unusable). Only Superior bay 16 = 3×3
confirmed so far.

### Phase 2 — 2.5D lane side-view (read-only)
- For depth>1 areas: each (bay, slot) is a lane; render a front→back track of `depth_position` cells. Horizontal scroll for deep lanes (Soo Locks = 17). Depth header row (D1…Dn).
- Same status colors. All cells equal (no LIFO styling).

### Phase 3 — slot interaction: tap (info + open-bay) and long-press (move)
Two gestures on an occupied slot (confirmed via mockups `slot_tap_modal_and_longpress`,
`slot_modal_with_adjust_qty`):

- **Single tap → info modal.** Shows SKU, description, lot number, quantity, status
  ("In backstock"). Primary action **"Open the bay → send to picking floor"**: releases
  the **whole pallet**, clears the slot, logs to `move_transactions` with reason
  `RELEASED_TO_PICKING`. Pallet is NOT hard-deleted — it's tracked as released (set
  `status = CONSUMED` / clear `current_location_id`, and the move_transactions row is the
  history). Casey wants pallet history preserved via `move_transactions`.
  - **Small secondary "Adjust qty" control** (not prominent) for the rare partial pull:
    enter quantity removed → if full, slot opens; if partial, `pallets.quantity` reduces
    and the slot keeps the remainder. Partial pull also logs to `move_transactions`.
- **Long-press (~0.5s) → move mode.** Then tap any open slot to relocate via
  `move_pallet(pallet_id, to_location_id)`. Same select→place model in both renderers.
  Respects existing move rules + back-compaction for deep lanes.
- **Touch cue:** show a fill/ring animation during the long-press hold so the picker knows
  it registered before move-mode fires.

**Select mode (batch release)** — confirmed via mockup `backstock_multiselect_open_bays`:
- An explicit **"Select mode" toggle** (not a gesture, so it doesn't collide with tap/long-press).
  When on, tap = select/deselect a pallet (checkbox circle); when off, tap/long-press behave normally.
- **Cross-aisle and cross-bay selection allowed** — a picker can select pallets from any bay/aisle
  in the area in one batch (e.g. 3 from Aisle 1 + 2 from Aisle 3). Selection persists across the
  scrolling board.
- Action bar shows running count + selected SKUs, a Clear button, and **"Open bays → picking"**.
- Batch release is **whole-pallet only / all-or-nothing per pallet** — each selected pallet writes
  its own `RELEASED_TO_PICKING` row to `move_transactions` (identical to single open-bay, just
  batched). Partial-qty pulls remain a single-pallet action in the tap modal (not available in batch).
- Mirrors the mobile app's batch-pick pattern (explicit multi-select mode) for consistency across apps.

### Phase 4 — add pallet (place into empty slot)
- Tap an **open** cell → "Place pallet" → pick SKU + qty (+ lot) → insert pallet at that
  `location_id`. Logs to `move_transactions` (reason e.g. `PUTAWAY` / `INBOUND_PUTAWAY`).
  Reuses inbound/receiving concepts; may route through a small RPC for atomicity.
- (Delete/remove is now covered by "open the bay" + adjust-qty in Phase 3 — no separate
  delete action needed.)

### Floor-stack same-SKU rule (warn, don't block)

Floor-stacked areas — **Whitefish, Mackinac, Ontario, Soo Locks, Potawatomi** — store pallets
**2 high on the warehouse floor (not in racking)**, so a stack of 2 is physically one
column. Business rule: **the two pallets in a 2-high stack should be the same SKU.**

Identified by the **`warehouse_areas.is_floor_stacked`** flag (Phase 0b), NOT by depth —
Potawatomi is depth-1 (25 bays × 2 high × 1 deep) yet floor-stacked. The renderer also keys
the 2.5D-vs-2D choice off this flag for depth-1 floor areas (Potawatomi renders as 2-high
stacks, not a flat top-down grid).

- **Scope:** the rule applies to **level 1 + level 2 at the SAME depth position** of a bay.
  Different depth positions in the same lane/bay MAY hold different SKUs. (Not whole-lane,
  not whole-bay.)
- **Enforcement: warn, don't block.** When a move/place would put a pallet on a stack whose
  other level already holds a *different* SKU, show a strong warning ("Stacking a different
  SKU on a floor stack — Mackinac bay 5 depth 2 already holds 57489") but allow the user to
  proceed. Mirrors the "off-route = penalty not ban" philosophy.
- **Where it lives:** `classifyMoveDestination` (and the place-pallet flow) detect the
  other-level occupant for floor-stacked areas and surface the warning. The 2D/2.5D renderer
  can also tint a mismatched stack so it's visible at a glance.
- Identify floor-stacked areas by depth>1 (the deep/2.5D areas) — same set the lane view uses.
  (If a depth>1 area ever needs racking semantics instead, add an explicit `is_floor_stacked`
  flag on `warehouse_areas`; not needed yet since deep = floor-stacked today.)

### Audit trail
Every inventory-touching action — move, whole-pallet release, partial pull, add —
writes a `move_transactions` row. Reasons: `STANDARD_MOVE` (existing), `RELEASED_TO_PICKING`
(open bay), `RELEASED_TO_PICKING_PARTIAL` (partial), `PUTAWAY` (add). Gives full history of
what entered/left each slot and when.

### Phase 5 — polish
- Selected-cell highlight, move animation, undo-last-move, tablet touch sizing (44px targets), per-area utilization header.

---

## Open questions

1. **Lane gaps — RESOLVED: compact toward the BACK, front stays open.** No gaps allowed. After a pull (or on any move), pallets settle to the **back** of the lane and empty positions accumulate at the **front** (the access end). Rationale: keeps front positions free for the next putaway. Implementation: when rendering/validating a lane, occupied positions are right-justified (toward max depth); a move that would create a front-of-filled gap auto-compacts. The renderer draws filled cells at the back, open cells at the front of each lane.
2. **Add-pallet SKU source** — free SKU pick, or only SKUs routed to that area (soft warning if off-route, mirroring the inbound scorer)?
3. **Delete semantics** — does "delete" mean pallet consumed (shipped/picked) vs. data correction (mistake)? May want two actions with different audit trails in `move_transactions`.
4. **Floor map → area-view depth detection** — drive renderer choice off `max(depth_position)` per area, or an explicit `area.layout_type` column? (Computed is fine for now.)

---

## Build dependencies
- Phase 0 shares the named-backstock migration (`named-backstock-proximity-plan.md`).
- Phases 1–5 are independent of the inbound-routing scorer change — can build in parallel.
- Nothing here needs 3D libraries or coordinates beyond what `locations` already stores.
