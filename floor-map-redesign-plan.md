# Floor Map Redesign — Implementation Plan

**Page:** TBF Backstock → Floor Map (`Live Location Status`, the app landing route `/floor-map`)
**Target:** Desktop-first, tablet-friendly (single layout that reflows; no separate mobile design)
**Scope:** Styling + information-hierarchy pass. No data-model or routing changes. Maps onto existing `FloorMap.tsx` and `styles.css`.
**Files touched:** `client/src/screens/FloorMap.tsx`, `client/src/styles.css`, `client/src/components/StatusBadge.tsx` (minor)

---

## Goal

Turn the Floor Map from a flat grid of equally-weighted tiles into a triage view: a floor lead should land on the page and immediately see (1) how full the warehouse is, (2) what needs attention (overflow, blocked), and (3) where the open slots are — without decoding small badges. Every signal in this plan derives from fields that already exist in the data model (`LocationStatus`, `area.areaType`, `currentPallet`, `isFlexSlot`); nothing new needs to be migrated.

---

## Data confirmation (already in `client.ts`)

- `LocationStatus = OPEN | OCCUPIED_HOME_SKU | OCCUPIED_OVERFLOW_SKU | RESERVED_HOME_SLOT | OPEN_FLEX_SLOT | BLOCKED`
- `AreaType = FRONT_HOME | BACKSTOCK | FLEX_RESERVE | OVERFLOW | RECEIVING`
- `location.currentPallet`, `location.isFlexSlot`, `location.allowsOverflow` all present
- Existing helper `isLocationOpen(location)` = `status !== "BLOCKED" && !currentPallet` — reuse for the "Open only" filter and the open-slot count

No backend or migration work required.

---

## Change 1 — Metric row becomes a triage strip

**Current:** four equal neutral cards — Locations, Occupied, Flex Slots, Backstock. All decorative; none signals a problem.

**Proposed:** four cards where the two action cards carry semantic color.

| Card | Value | Style |
|------|-------|-------|
| Locations | `counts.total` | neutral (`--color-background-secondary`) |
| Occupied | `counts.occupied` + utilization `%` as a muted suffix | neutral |
| Overflow | count of `area.areaType === "OVERFLOW"` currently holding a pallet | **amber** fill when > 0, neutral when 0 |
| Blocked | count of `status === "BLOCKED"` | **red** fill when > 0, neutral when 0 |

- Drop "Flex Slots" from the strip (low action value) and move flex into the filter pills instead. "Backstock" likewise becomes a filter rather than a headline metric, since the redesigned strip is about *exceptions*, not inventory breakdown.
- Utilization %: `Math.round((occupied / total) * 100)`. Guard `total === 0`.
- Color only when the count is non-zero, so a clean floor reads all-neutral and a problem floor lights up. Amber = `#FAEEDA` bg / `#854F0B` label / `#633806` number. Red = `#FCEBEB` bg / `#A32D2D` label / `#791F1F` number.

**`counts` memo additions in `FloorMap.tsx`:**
```ts
const counts = useMemo(() => {
  const total = locations.length;
  const occupied = locations.filter((l) => l.currentPallet).length;
  return {
    total,
    occupied,
    utilizationPct: total ? Math.round((occupied / total) * 100) : 0,
    overflow: locations.filter(
      (l) => l.area?.areaType === "OVERFLOW" && l.currentPallet,
    ).length,
    blocked: locations.filter((l) => l.status === "BLOCKED").length,
  };
}, [locations]);
```

---

## Change 2 — Filters become pills with a visible active state

**Current:** two `<select>` dropdowns (Area, Status) + a Refresh button. The active selection is hidden until you open the dropdown — extra taps on a tablet.

**Proposed:** a horizontal pill bar. Each pill is a toggle that shows its own active state.

- Quick filters: `All areas` · `Backstock` · `Overflow` · `Open only`. ("Open only" uses `isLocationOpen`.)
- Active pill: solid fill (`--color-text-primary` bg, inverted text). Inactive: `0.5px` border, transparent.
- Keep one `<select>` for the long tail (specific area / specific status) but lead with the pills for the common cases.
- Replace the blind **Refresh** button with a live "Updated Xm ago" stamp plus a small refresh icon-button. Track `lastLoadedAt` state, set it in `loadLocations`'s `finally`, render relative time.
- **Tablet:** pills wrap to a second row naturally (`flex-wrap: wrap`); each pill min-height `40px` for touch.

**State:** the existing `areaFilter` / `statusFilter` strings can stay; add a derived `quickFilter` or fold "Open only" into `statusFilter === "OPEN_ONLY"` handled in `filteredLocations`.

---

## Change 3 — Location tiles read status from a colored dot, not only a left border

**Current:** status lives in a thin 5px left border + a small text badge. Hard to scan in a dense grid; occupied vs open look nearly identical.

**Proposed:** keep the colored left border (cheap redundancy) **and** add a filled status dot in the tile's top-right, plus a one-word status line.

- Dot colors (reuse existing border-color mapping):
  - Home SKU occupied → green `#1D9E75`
  - Overflow occupied → amber `#EF9F27`
  - Reserved / flex reserve → blue `#2563EB`
  - Blocked → red `#E24B4A`
  - Open → no dot; tile gets the empty treatment (Change 4)
- Status line: short human label under the code — `LP-4471 · 16" Bear`, `Overflow · LP-4480`, `Blocked · damage`, `Open`. Color the line to match the status (amber/red text) so it's legible at a glance.
- Keep `D{depthPosition}` and `fullLocationCode`. Drop the `rule-tags` row from the default tile (Home / Flex / Overflow OK) — move those to a hover/expanded state or tile detail, since they add noise to every tile.

**`StatusBadge`** can stay for other screens; on the Floor Map tile, replace the badge with the dot + status line. Optionally add a `statusDotColor(status)` helper next to `formatLabel`.

---

## Change 4 — Open slots look empty

**Current:** open slots look the same as occupied — same border weight, same fill.

**Proposed:** open tiles get a dashed border, muted `--color-background-secondary` fill, no dot, and a faint "Open" label. This makes available space pop out during a putaway scan, which is the page's primary job.

```css
.location-tile.open,
.location-tile.open-flex-slot {
  border: 0.5px dashed #c9d2dc;
  border-left: 0.5px dashed #c9d2dc;   /* drop the accent border on open */
  background: #f8fafc;
}
```

---

## Change 5 — Per-area legend

Add a compact legend strip at the bottom of each `.area-map` (or once at the top of the floor layout) mapping dot color → meaning: Home SKU · Overflow · Blocked · Open. Anchors the color language right next to the tiles instead of forcing recall.

---

## Tablet behavior (desktop-first, reflow down)

- Existing breakpoint is `@media (max-width: 860px)`. iPad portrait is 768px (inside it), landscape 1024px (outside). Add an **intermediate breakpoint at ~1024px** so landscape tablet keeps the sidebar but tightens the floor/recent-moves split.
- At ≤860px the sidebar already collapses to a 2-col nav and `.floor-layout` goes single-column — keep that; just verify the new pill bar and triage strip reflow.
- Touch targets: pills, icon-button, and any tile that becomes tappable → min 40px (44px preferred). The base `button`/`input` min-height is already 40px.
- `.metric-row` at ≤860px: switch from 4-up to 2-up (`repeat(2, 1fr)`) so numbers stay readable on a narrow tablet portrait — currently it collapses to 1-up, which wastes vertical space.

```css
@media (min-width: 861px) and (max-width: 1024px) {
  .floor-layout { grid-template-columns: minmax(0, 1fr) 280px; }
}
@media (max-width: 860px) {
  .metric-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

---

## Build order

1. `counts` memo + triage metric strip (Change 1) — pure render, lowest risk.
2. Tile dot + status line + open-slot empty styling (Changes 3 & 4) — the highest-impact visual change.
3. Filter pills + "Updated Xm ago" (Change 2).
4. Per-area legend (Change 5).
5. Tablet breakpoints + touch-target audit.
6. Verify: load real data, confirm overflow/blocked counts match a manual query, check 1024px and 768px widths in browser devtools.

## Out of scope (parking lot)
- Clickable tiles → location detail / move shortcut.
- Realtime subscription on `locations` (the mobile app already uses Supabase Realtime; could mirror here).
- Replenishment threshold overlay (depends on the `get_sku_pull_totals` RPC still on the parking lot).
