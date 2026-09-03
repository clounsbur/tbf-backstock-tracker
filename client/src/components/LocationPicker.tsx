import { useMemo } from "react";
import { Pencil } from "lucide-react";
import type { Location } from "../api/client";
import { locationStatusLabel } from "./StatusBadge";
import { floorPositionLabel, rackPositionLabel } from "./rackPosition";

// Same visual language as the Floor Plan drill-in view (grouped by bay, tinted
// by status) so location selection looks and behaves consistently everywhere
// in the app. Only locations that aren't occupied/blocked are tappable, and
// tapping toggles that location in/out of the (possibly multi-) selection.

function statusColor(location: Location): { border: string; bg: string } {
  switch (location.status) {
    case "BLOCKED":
      return { border: "#E24B4A", bg: "#FCEBEB" };
    case "OCCUPIED_OVERFLOW_SKU":
      return { border: "#EF9F27", bg: "#FAEEDA" };
    case "OCCUPIED_HOME_SKU":
      return { border: "#1D9E75", bg: "#E1F5EE" };
    case "RESERVED_HOME_SLOT":
    case "OPEN_FLEX_SLOT":
      return { border: "#2563EB", bg: "#fff" };
    default:
      return { border: "#9aa8b6", bg: "#f8fafc" };
  }
}

function isSelectable(location: Location): boolean {
  return location.status === "OPEN" || location.status === "OPEN_FLEX_SLOT" || location.status === "RESERVED_HOME_SLOT";
}

export function LocationPicker({
  locations,
  selectedIds,
  onToggle,
  onEditOccupied,
}: {
  locations: Location[];
  selectedIds: ReadonlySet<string>;
  onToggle: (location: Location) => void;
  // Tapping an already-occupied tile can't add it to the selection (there's
  // nowhere to put a new pallet), but its pallet's quantity/lot might have
  // been typed in wrong -- this opens an editor for that instead.
  onEditOccupied?: (location: Location) => void;
}) {
  const bays = useMemo(() => {
    const byBay = new Map<string, Location[]>();
    for (const loc of locations) {
      const list = byBay.get(loc.bay) ?? [];
      list.push(loc);
      byBay.set(loc.bay, list);
    }
    return Array.from(byBay.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([bay, list]) => {
        const rows = list.map((l) => l.slotRow).filter((r): r is number => r != null);
        const cols = list.map((l) => l.slotCol).filter((c): c is number => c != null);
        return {
          bay,
          tiles: list.sort(
            (a, b) => a.depthPosition - b.depthPosition || a.level.localeCompare(b.level, undefined, { numeric: true }),
          ),
          maxSlotRow: rows.length ? Math.max(...rows) : 0,
          maxSlotCol: cols.length ? Math.max(...cols) : 0,
        };
      });
  }, [locations]);

  if (locations.length === 0) {
    return <p className="subtle">No locations in this area yet.</p>;
  }

  return (
    <div className="floorplan-bay-list">
      {bays.map((bayGroup) => (
        <div key={bayGroup.bay} className="floorplan-bay-row">
          <div className="floorplan-bay-label">Bay {bayGroup.bay}</div>
          <div className="floorplan-bay-tiles">
            {bayGroup.tiles.map((location) => {
              const c = statusColor(location);
              const selectable = isSelectable(location);
              const editable = !selectable && Boolean(onEditOccupied) && Boolean(location.currentPallet);
              const isSelected = selectedIds.has(location.id);
              const posLabel =
                rackPositionLabel(location, bayGroup.maxSlotRow, bayGroup.maxSlotCol) ??
                floorPositionLabel(location, bayGroup.tiles);
              return (
                <div
                  key={location.id}
                  className={`floorplan-tile${selectable ? " selectable" : ""}${editable ? " editable" : ""}${isSelected ? " selected" : ""}`}
                  style={{ borderColor: c.border, background: c.bg, opacity: selectable || editable ? 1 : 0.6 }}
                  title={editable ? `Edit ${location.fullLocationCode}'s quantity/lot` : location.fullLocationCode}
                  role={selectable || editable ? "button" : undefined}
                  aria-pressed={selectable ? isSelected : undefined}
                  onClick={selectable ? () => onToggle(location) : editable ? () => onEditOccupied!(location) : undefined}
                >
                  {editable && <Pencil size={11} className="floorplan-tile-edit-hint" aria-hidden="true" />}
                  {posLabel && <span className="floorplan-tile-pos">{posLabel}</span>}
                  <span className="floorplan-tile-code">{location.fullLocationCode}</span>
                  <span className="floorplan-tile-detail">
                    {location.currentPallet
                      ? location.currentPallet.sku?.partNumber ?? location.currentPallet.palletLicensePlate
                      : locationStatusLabel(location.status)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
