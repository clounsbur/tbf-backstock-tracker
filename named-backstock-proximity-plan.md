# Named backstock areas + proximity-based priority — FINALIZED PLAN

**Status:** Plan only — ready to build. Layout + routing fully locked Session 12. No open inputs remain.
**Logged:** Session 12.

## The seven named areas (FINAL)

Dedicated reserved backstock areas, all `area_type = BACKSTOCK`, all prioritized over temporary overflow:

`Superior` · `Michigan` · `Huron` · `Erie` · `Ontario` · `Soo Locks` · `Whitefish`

(Potawatomi and Mackinac/Swamp were dropped; Soo Locks and Whitefish added. Whitefish is a last-resort fallback — see routing.)

---

## Recommendation 1 — model them as seven `warehouse_areas` rows

Make each name its own row in `warehouse_areas` (replacing the single generic "Named Backstock" the demo seed created), not a `zone` field on `locations`.

Why:
- The Floor Map groups by **area** (`groupLocations` keys on `location.area.id`) — seven areas means seven labelled sections on the map. Zones would not show as separate sections without rewriting the grouping.
- The inbound scorer already keys off `location.area.areaType` and `location.area.sortOrder` — real areas slot straight into scoring.
- Move Pallet / SKU Search already join and display `area.name` — they'd show "Superior" etc. for free.

Each location then belongs to exactly one named area (its `area_id`), plus we still keep `zone/aisle/bay/depth` for within-area addressing.

---

## Recommendation 2 — priority is COMPUTED per SKU, not a stored ranking

Casey's intent: *"priority based on proximity to the item's permanent floor location, and the location to the nearest backstock area."*

This is the key design point. The seven areas do **not** have a fixed global order (Superior is not always #1). Instead, for a given SKU being put away:

1. The SKU has a **permanent floor location** — its front-home pick face (`is_front_home_slot = true`, `home_product_id = sku`).
2. The best backstock area is the one **physically closest to that pick face**.
3. Within that area, the best location is the one closest to the area's access point / lowest travel sequence.

So the ranking of the seven areas is **different for every SKU**, driven by distance from that SKU's home. A SKU homed near Superior fills Superior first; a SKU homed near Erie fills Erie first. This matches how a picker actually works — you don't want a 16" Bear's reserve stock on the opposite side of the building from where it's picked.

## Physical layout (FINAL — from `named-backstock-layout-template.csv`)

Addressing model (confirmed with Casey):
- A location is **Area → Bay → Slot → (Depth)**.
- A **slot** is a position within a bay; **depth** is how many pallets deep that lane runs.
- **Location code is depth-conditional:** depth-1 areas use `AREA-BAY-SLOT`
  (e.g. `Superior, Bay 7, Slot 3`); multi-depth areas append depth
  (e.g. `Soo Locks, Bay 1, Slot 2, Depth 11`).
- Schema mapping: your **bay → `bay`**, **slot → `level`**, **depth → `depth_position`**.

| Area | Bays | Slots/bay | Depth | Notes & exceptions |
|---|---|---|---|---|
| Superior | 27 | 6 (bay 16 = 9) | 1 | All bays 2×3 except bay 16 = 3×3. "5/4 slot" = *usable* capacity (full 2×3 with positions flagged): bay 7 (1 flagged), bays 8,9 (2 flagged). Height-flagged slots: 10-1, 10-2, 17-1, 22-1, 22-2, 27-2 |
| Michigan | 15 | varies | mixed | **Merged single area, bays 1–15 (Mackinac dropped, Session 12).** Bays 1–2: 2×2, depth 1, racking, all height-flagged. Bays 3–11: 2 high, depth 3, floor-stacked. Bays 12–15: 2 high, depth 2, floor-stacked. Mixed-depth is fine now (uniform-depth constraint scrapped along with the depth-based renderer split). `is_floor_stacked = true` (has floor sections). 78 locations. |
| Huron | 11 | 4 | 1 | Height-flagged: 8-1, 9-2, 11-1, 11-2 |
| Erie | 10 | 6 (or 9) | 1 | **⚠ CSV said bays 4,5,6,8,9 = "8 slots" — but all bays are 2×3 (6) or 3×3 (9). Need Casey to confirm: are those 3×3 (9 physical) bays, or 2×3 with usable=8? TBD.** Bay 10 "4 slots" = 2×3 with 2 flagged. Height-flagged: 1-1,1-2,2-1,2-2,10-1,10-2 |
| Ontario | 4 | 2 high | 4 | Deep lanes, floor-stacked |
| Soo Locks | 1 | 2 high | 17 | One very deep lane (2 high × 17 deep), floor-stacked |
| Whitefish | 3 | 2 high | 3 | Last-resort area, floor-stacked |
| Potawatomi | 25 | 2 high (1 wide) | 1 | **9th area (added Session 12).** 25 bays each 1 wide × 2 high, depth 1 = 50 positions. Floor-stacked but depth-1 — utilizes leftover floor space. |

**Floor-stacked vs. racking:** `warehouse_areas.is_floor_stacked` flag marks the floor areas —
**Michigan (bays 3–15), Ontario, Soo Locks, Whitefish, Potawatomi**. The 2-high same-SKU rule
keys off this flag. Note Michigan is now MIXED: bays 1–2 are racking, bays 3–15 floor-stacked —
so the same-SKU stack rule is really **per-bay** (applies only to floor-stacked bays), even
though the flag is area-level. Pure racking areas: Superior, Huron, Erie.

**Area count is now 8** (Mackinac merged into Michigan Session 12): Superior, Michigan, Huron,
Erie, Ontario, Soo Locks, Whitefish, Potawatomi.

**Area split (Session 12):** original Michigan was mixed-depth (bays 1–2 depth-1,
bays 3–11 depth-3). Split into **Michigan** (depth-1) + **Mackinac** (depth-3) so every
area is uniform-depth — simplifies both the seed and the interactive renderers (depth-1
→ 2D top-down, depth>1 → 2.5D lane view). See `interactive-area-map-plan.md`. Bays remain
non-uniform in slot count (Superior, Erie), so the seed still generates per-bay, not a flat grid.

### Aisle structure (from Casey's floor diagram, Session 12)

Most areas are a single block of bays, but two are multi-aisle. Use the existing
`locations.aisle` field to group bays within an area (no schema change). Aisles drive
how the 2D map lays out (one block per aisle, side by side).

| Area | Aisles | Bay ranges per aisle |
|---|---|---|
| **Superior** | 5 | aisle 1: bays 1–7 · aisle 2: bay 8 · aisle 3: bays 9–16 · aisle 4: bays 17–23 · aisle 5: bays 24–27 |
| **Huron** | 2 (+ end-cap) | aisle 1: bays 1–9 · aisle 2: bays 11–19 · **bay 10: single end-cap bay across the top, above both aisles** |
| Michigan | 1 | bays 1–2 |
| Mackinac | 1 | bays 3–11 |
| Erie | 1 | bays 1–10 |
| Ontario | 1 | 4 bays |
| Soo Locks | 1 | 1 bay |
| Whitefish | 1 | 3 bays |

Colors on the diagram are visual grouping only — no data meaning.

Huron bay 10 is an **end-cap** bay sitting across the top of the two aisles (above both
1–9 and 11–19). In the 2D renderer it draws as a single bay spanning the top of the
Huron block. Model it as its own aisle (e.g. `aisle = 'cap'` or a third aisle) so it
isn't lumped into either run. No remaining TBDs for the aisle structure.

**Routing note:** "16" plush (lower)" and "8" plush" now route to Michigan AND Mackinac
(both are the former Michigan). The Michigan/Huron item-code split (the TBD) applies across
the Michigan+Mackinac pair vs. Huron.

## Schema additions needed

1. **`locations.is_shortened_height boolean not null default false`** — the "shortened
   height capacity" flag on specific slots (e.g. Superior 10-1). Surfaced on the Floor
   Map tile and usable as an inbound constraint later (tall pallets shouldn't route to
   shortened slots).
2. **Non-uniform bays** — no schema change, but the seed must encode per-bay slot counts
   and per-bay depth (Michigan), not a single area-wide grid. Handled in seed logic.
3. **`warehouse_areas.is_last_resort boolean not null default false`** — marks Whitefish
   so the scorer can rank it below all routed areas but above temporary overflow.

(`backstock_routing` table unchanged from prior draft — see below.)

## Routing table (FINAL, locked)

```sql
create table public.backstock_routing (
  id                text primary key default gen_random_uuid()::text,
  family            text not null check (family in ('plush','fiber','accessories','clothing')),
  item_code_min     text,                 -- inclusive; nullable
  item_code_max     text,                 -- inclusive; nullable
  backstock_area_id text not null references public.warehouse_areas(id),
  rank              integer not null,      -- 1 = first choice; NULL rank handled as proximity (see note)
  by_proximity      boolean not null default false,  -- true = order Michigan/Huron by item-code split, not fixed rank
  created_at        timestamptz not null default now()
);
create index on public.backstock_routing (family);
```

| Family / segment | Item-code rule | Areas (ranked) |
|---|---|---|
| Fiber | family = fiber | Superior (1) → Ontario (2) → Soo Locks (3) → Whitefish (last-resort) |
| Accessories | family = accessories | Superior (1) |
| 16" plush — upper | item_code > 60725 | Superior (1) |
| 16" plush — lower | item_code ≤ 60725 | **Michigan + Mackinac + Huron — equal, route by open capacity** |
| 8" plush | 50000–50999 | **Michigan + Mackinac + Huron — equal, route by open capacity** |
| Clothing | family = clothing | Erie (1) → Huron (2) |
| Plush + fiber overflow | — | Whitefish — last resort only |

### Michigan / Mackinac / Huron — equal by capacity (RESOLVED)
For **8" plush and 16"-lower**, Michigan, Mackinac, and Huron are **equal-priority** —
route to whichever has open capacity, no item-code split, no fixed rank. In
`backstock_routing` these are rows with the **same rank** (e.g. all rank 1) for the
family/segment; the scorer then breaks the tie by **open capacity / travel sequence**
rather than a stored order. (No cutoff number needed — the earlier "item-code split"
idea is dropped.)

`routingRank` returns the shared rank for any of the three; final placement among them
falls to the existing capacity/travel-sequence tiebreak.

Data note: 8" codes 50002–50405; 16" codes 57489–61020; 60725 splits 16" into 113 lower / 43 upper (used only for the lower/upper family segment boundary, not for Michigan/Huron).

### Floor-stack same-SKU rule (Whitefish, Mackinac, Ontario, Soo Locks)
These deep areas are **floor stacks 2 high (not racking)**. The 2 pallets in a stack
(level 1 + level 2 at the same depth position) **should be the same SKU**. Enforced as a
**warning, not a hard block** in `classifyMoveDestination` / place-pallet flow — discourage
a mismatched stack but allow override. Scope = the 2-high stack only, not the whole lane or
bay. (Detail in `interactive-area-map-plan.md`.)

### Whitefish (last-resort) handling
`is_last_resort = true`. In the scorer it scores **below every routed area but above
temporary overflow** — i.e. used only when no routed backstock is open, but still
preferred over dumping to temp overflow.

---

## Change to the inbound scorer (`client.ts` → `scoreLocationForSku`)

Replace the flat `+40` BACKSTOCK bonus (lines 250-253) with:

```ts
if (location.area?.areaType === "BACKSTOCK") {
  score += 40;                                       // beats overflow (-30)

  if (location.area.isLastResort) {
    score += 2;                                      // just above overflow, below all routed areas
    reasons.push({ code: "LAST_RESORT", label: "Last-resort backstock — use only if nothing else open" });
  } else {
    const rank = routingRank(sku, location.area);    // null if this area not on the SKU's route
    if (rank != null) {
      score += Math.max(0, 40 - (rank - 1) * 12);    // #1 +40, #2 +28, #3 +16, #4 +4 ...
      reasons.push({ code: "ROUTE_MATCH", label: `Preferred backstock #${rank} for this SKU` });
    } else {
      score -= 15;                                   // off-route named area: discourage, don't forbid
      reasons.push({ code: "OFF_ROUTE", label: "Not a preferred area for this SKU — allowed only if nothing better" });
    }
  }
}
```

`routingRank(sku, area)` derives the SKU's routing key (`skuRoutingKey`), looks up
`backstock_routing` for that family/segment, and returns this area's rank (handling
the Michigan/Huron item-code split). The existing `travelSequence` term breaks ties
within the winning area.

Net ranking, high → low:
1. SKU's own home slot (+100)
2. On-route #1 (+80) → #2 (+68) → #3 (+56) → #4 (+44) …
3. Off-route named backstock (+25)
4. Whitefish last-resort (+42 base but only when nothing routed is open — see note*)
5. Temporary overflow (−30)

\*Whitefish nuance: +40+2 = +42 is numerically above off-route's +25, which is correct
(Whitefish should beat a wrong-family area). It sits below any *on-route* area (≥ +44).
If field testing shows Whitefish being chosen too eagerly, lower its bonus or gate it
behind a "no routed area open" check like overflow already has.

### Deriving family/segment (`skuRoutingKey`)
Prefer `products.product_family` if it cleanly holds plush/fiber/accessories/clothing.
Fallback heuristic from item_code + description: `8"` desc + code 50xxx → plush 8";
`16"` desc (57xxx–61xxx) → plush 16" (split at the TBD cutoff); fiber/stuffing → fiber;
outfit/hoodie/dress → clothing; shoe/glasses/hat → accessories.
(Fiber SKUs `31002-Eco`, `31001-ZOO`, etc. from Ontario/Soo Locks notes are **not yet
in the products table** — route them by `family = fiber` for now; add the SKUs later.)

---

## Floor Map impact
- Seven map sections with real names. Plus the new `is_shortened_height` flag can show
  as a small tile marker (e.g. a "↧ low" chip) once built.
- Triage cards unaffected — all seven stay `area_type = BACKSTOCK`.

---

## Decisions locked (Session 12, final)

1. **Areas (7):** Superior, Michigan, Huron, Erie, Ontario, Soo Locks, Whitefish.
2. **Addressing:** Area→Bay→Slot→(Depth); code drops depth segment when depth = 1.
3. **Bays are non-uniform** — per-bay slot counts and (Michigan) per-bay depth. Seed encodes exceptions.
4. **New columns:** `locations.is_shortened_height`, `warehouse_areas.is_last_resort`.
5. **Routing (final):** see table. Fiber Superior→Ontario→Soo Locks→Whitefish; accessories Superior; 16"-upper Superior; clothing Erie→Huron; 8" + 16"-lower split Michigan/Huron by item-code.
6. **Michigan/Huron** ordered **by item-code split** — cutoff is the one TBD.
7. **Whitefish** = last-resort (`is_last_resort`), below routed areas, above temp overflow.
8. **Off-route = penalty, not ban.** Strong preference preserved.
9. **Fiber 31xxx SKUs** not yet loaded — route by family for now.

## Build order (ready — no open inputs)
1. Migration: 8 `warehouse_areas` (the 7 + Mackinac from the Michigan split; + `is_last_resort`)
   and their locations via per-bay seed logic, with `is_shortened_height` on flagged slots and
   depth-conditional codes.
2. `backstock_routing` table + seed rows from the final routing table. Michigan, Mackinac, and
   Huron get the **same rank** for 8"/16"-lower (equal — capacity tiebreak).
3. `skuRoutingKey` + `routingRank` helpers + scorer change in `client.ts`. Tie among equal-rank
   areas resolved by open capacity / travel sequence.
4. Reassign demo home SKUs coherently (fiber near Superior, clothing near Erie, etc.).
5. Verify in Inbound Suggestions: fiber → Superior #1; clothing → Erie #1; 16"-upper → Superior #1;
   8"/16"-lower → whichever of Michigan/Mackinac/Huron has capacity; Whitefish only when others full.
