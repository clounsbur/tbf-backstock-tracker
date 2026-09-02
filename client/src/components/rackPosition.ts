import type { Location } from "../api/client";

// Plain-language position within a rack bay's grid, e.g. "Top-L", "Level 2-Mid",
// "Bottom-R" -- shown alongside the location code so someone unfamiliar with
// the code scheme can still tell where a slot physically is. Row 1 is the top
// of the rack; only the very top and bottom rows get a plain word, rows in
// between are numbered. Column wording adapts to however wide the bay is.
// Shared by Floor Plan and Floor Map so the two screens never disagree.
export function rackPositionLabel(location: Location, maxRow: number, maxCol: number): string | null {
  if (location.slotRow == null) return null;

  const rowLabel =
    maxRow <= 1
      ? null
      : location.slotRow === 1
        ? "Top"
        : location.slotRow === maxRow
          ? "Bottom"
          : `Level ${location.slotRow}`;

  let colLabel: string | null = null;
  if (location.slotCol != null && maxCol > 1) {
    if (maxCol === 2) colLabel = location.slotCol === 1 ? "L" : "R";
    else if (maxCol === 3) colLabel = location.slotCol === 1 ? "L" : location.slotCol === 3 ? "R" : "Mid";
    else colLabel = `${location.slotCol}`;
  }

  if (rowLabel && colLabel) return `${rowLabel}-${colLabel}`;
  return rowLabel ?? colLabel;
}

// Plain-language position for a floor-stacked location, e.g. "D1 Top" /
// "D1 Bottom" when a second pallet is stacked on top of the first at that
// depth, or just "D1" when only one pallet sits there. `bayLocations` is
// every location in the same bay so the sibling(s) at this depth can be
// found; the location with the numerically highest `level` is "Top".
export function floorPositionLabel(location: Location, bayLocations: Location[]): string {
  const depthLabel = `D${location.depthPosition}`;
  const atDepth = bayLocations.filter((l) => l.depthPosition === location.depthPosition);
  if (atDepth.length <= 1) return depthLabel;

  const top = atDepth.reduce((best, l) =>
    l.level.localeCompare(best.level, undefined, { numeric: true }) > 0 ? l : best,
  );
  return `${depthLabel} ${top.id === location.id ? "Top" : "Bottom"}`;
}
