import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api, type Location, type Sku } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";

type Box = {
  area: string | null;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  labelBottom?: boolean;
};

const TINTS: Record<string, { bg: string; border: string }> = {
  Superior: { bg: "#eef2ff", border: "#8b9cf6" },
  Potawatomi: { bg: "#ffe7d1", border: "#fb923c" },
  "Soo Locks": { bg: "#d8f0fd", border: "#38bdf8" },
  Huron: { bg: "#d5f7ec", border: "#34d399" },
  Erie: { bg: "#f0e2ff", border: "#c084fc" },
  Michigan: { bg: "#fdf3c4", border: "#eab308" },
  Ontario: { bg: "#fcdada", border: "#ef4444" },
  Whitefish: { bg: "#e2e8f0", border: "#64748b" },
};

const LAYOUT: Box[] = [
  { area: null, label: "Picking Floor", x: 30, y: 0, w: 45, h: 61 },
  { area: "Superior", label: "Superior", x: 0, y: 0, w: 23, h: 61, labelBottom: true },
  { area: "Potawatomi", label: "Potawatomi", x: 3, y: 4, w: 5, h: 48 },
  { area: "Potawatomi", label: "Potawatomi", x: 10, y: 4, w: 5, h: 33 },
  { area: "Soo Locks", label: "Soo Locks", x: 23, y: 0, w: 5, h: 61 },
  { area: "Huron", label: "Huron", x: 75, y: 0, w: 10, h: 62 },
  { area: "Erie", label: "Erie", x: 95, y: 0, w: 5, h: 87 },
  { area: "Michigan", label: "Michigan 1-2", x: 45, y: 94, w: 14, h: 6 },
  { area: "Michigan", label: "Michigan 3-11", x: 33, y: 62, w: 26, h: 18 },
  { area: "Michigan", label: "Michigan 12-15", x: 63, y: 69, w: 9, h: 10 },
  { area: "Ontario", label: "Ontario", x: 78, y: 78, w: 13, h: 22 },
  { area: "Whitefish", label: "Whitefish", x: 0, y: 83, w: 12, h: 15 },
];

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

export function FloorPlan() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchSku, setSearchSku] = useState<Sku | null>(null);
  const [searchByArea, setSearchByArea] = useState<Record<string, number>>({});
  const [searchSlots, setSearchSlots] = useState<Record<string, Location[]>>({});
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSlots, setShowSlots] = useState(false);

  const [drillArea, setDrillArea] = useState<string | null>(null);

  async function loadLocations() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listLocations();
      setLocations(response.locations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load locations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLocations();
  }, []);

  const countsByArea = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const location of locations) {
      const name = location.area?.name;
      if (name) counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }, [locations]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    setSearchError(null);
    setShowSlots(false);
    try {
      const response = await api.searchSkus(term);
      const sku =
        response.skus.find((candidate) => candidate.partNumber.toLowerCase() === term.toLowerCase()) ??
        response.skus[0] ??
        null;
      setSearchSku(sku);

      const byArea: Record<string, number> = {};
      const slots: Record<string, Location[]> = {};
      if (sku?.pallets) {
        for (const pallet of sku.pallets) {
          const areaName = pallet.currentLocation?.area?.name;
          if (!areaName) continue;
          byArea[areaName] = (byArea[areaName] ?? 0) + pallet.quantity;
          if (pallet.currentLocation) {
            slots[areaName] = [...(slots[areaName] ?? []), pallet.currentLocation];
          }
        }
      }
      setSearchByArea(byArea);
      setSearchSlots(slots);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setSearchSku(null);
      setSearchByArea({});
      setSearchSlots({});
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setSearchSku(null);
    setSearchByArea({});
    setSearchSlots({});
    setSearchError(null);
    setShowSlots(false);
  }

  const litAreas = Object.keys(searchByArea);
  const searchTotal = Object.values(searchByArea).reduce((sum, n) => sum + n, 0);

  const drillBays = useMemo(() => {
    if (!drillArea) return [];
    const tiles = locations.filter((l) => l.area?.name === drillArea);
    const byBay = new Map<string, Location[]>();
    for (const t of tiles) {
      const list = byBay.get(t.bay) ?? [];
      list.push(t);
      byBay.set(t.bay, list);
    }
    return Array.from(byBay.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([bay, list]) => {
        const sorted = list.sort(
          (a, b) =>
            a.depthPosition - b.depthPosition ||
            a.level.localeCompare(b.level, undefined, { numeric: true }),
        );
        // depth columns: each depth has its levels (top = highest level number first)
        const depthMap = new Map<number, Location[]>();
        for (const t of sorted) {
          const col = depthMap.get(t.depthPosition) ?? [];
          col.push(t);
          depthMap.set(t.depthPosition, col);
        }
        const depths = Array.from(depthMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([depth, levels]) => ({
            depth,
            levels: levels.sort((a, b) => b.level.localeCompare(a.level, undefined, { numeric: true })),
          }));
        const bayIsFloor = sorted.some((t) => t.slotRow == null);
        return { bay, tiles: sorted, depths, bayIsFloor };
      });
  }, [drillArea, locations]);
  const drillCount = useMemo(
    () => drillBays.reduce((n, b) => n + b.tiles.length, 0),
    [drillBays],
  );

  return (
    <section>
      <PageHeader eyebrow="Floor Plan" title="Warehouse Map" />

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search SKU to light up where it's stored"
        />
        <button type="submit" disabled={searching}>
          <Search size={18} aria-hidden="true" />
          {searching ? "Searching..." : "Search"}
        </button>
        {(searchSku || searchError) && (
          <button type="button" className="secondary-button" onClick={clearSearch}>
            Clear
          </button>
        )}
      </form>

      {searchError && <ErrorBlock message={searchError} />}

      {searchSku && (
        <div className={`floorplan-banner ${litAreas.length ? "" : "empty"}`}>
          {litAreas.length ? (
            <>
              <span>
                <strong>
                  {searchSku.partNumber} - {searchSku.description}
                </strong>
                : {searchTotal} units across {litAreas.length} area{litAreas.length > 1 ? "s" : ""} ({litAreas.join(", ")})
              </span>
              <button type="button" onClick={() => setShowSlots((value) => !value)}>
                {showSlots ? "Hide slots" : "Display slots"}
              </button>
            </>
          ) : (
            <span>{searchSku.partNumber} - no stock currently in backstock.</span>
          )}
        </div>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}

      {!loading && !error && (
        <div className="floorplan-map-wrap">
          <div className="floorplan-map">
            {LAYOUT.map((box, index) => {
              if (box.area === null) {
                return (
                  <div
                    key={`label-${index}`}
                    className="floorplan-zone"
                    style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                  >
                    {box.label}
                  </div>
                );
              }
              const areaName = box.area;
              const lit = searchByArea[areaName] != null;
              const narrow = box.w < 8;
              const tint = TINTS[areaName];
              const style: CSSProperties = {
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.w}%`,
                height: `${box.h}%`,
                justifyContent: box.labelBottom ? "flex-end" : "center",
              };
              if (tint && !lit) {
                style.background = tint.bg;
                style.borderColor = tint.border;
              }
              return (
                <button
                  key={`${box.label}-${index}`}
                  type="button"
                  className={`floorplan-area${lit ? " lit" : ""}`}
                  style={style}
                  onClick={() => setDrillArea(areaName)}
                  title={box.label}
                >
                  <span className={narrow ? "floorplan-area-name vertical" : "floorplan-area-name"}>{box.label}</span>
                  {!narrow &&
                    (lit ? (
                      <span className="floorplan-area-units">{searchByArea[areaName]} u</span>
                    ) : (
                      <span className="floorplan-area-count">{countsByArea[areaName] ?? 0}</span>
                    ))}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {searchSku && litAreas.length > 0 && showSlots && (
        <div className="panel floorplan-slots">
          <h2>{searchSku.partNumber} - slot locations</h2>
          {Object.entries(searchSlots).map(([areaName, slots]) => (
            <div key={areaName} className="floorplan-slot-group">
              <h3>
                {areaName} <span className="subtle">- {searchByArea[areaName]} units</span>
              </h3>
              <div className="floorplan-slot-chips">
                {slots.map((slot) => (
                  <span key={slot.id} className="floorplan-slot-chip">
                    {slot.fullLocationCode}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {drillArea && (
        <div className="panel floorplan-drill">
          <div className="panel-heading">
            <div>
              <h2>{drillArea}</h2>
              <p>{drillCount} locations</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => setDrillArea(null)}>
              Close
            </button>
          </div>
          <div className="floorplan-bay-list">
            {drillBays.map((bayGroup) => (
              <div key={bayGroup.bay} className="floorplan-bay-row">
                <div className="floorplan-bay-label">Bay {bayGroup.bay}</div>
                {bayGroup.bayIsFloor ? (
                  <div className="floorplan-lane">
                    {bayGroup.depths.map((col) => (
                      <div key={col.depth} className="floorplan-depth-group">
                        {bayGroup.depths.length > 1 && (
                          <div className="floorplan-depth-head">D{col.depth}</div>
                        )}
                        <div className="floorplan-stack-pair">
                          {col.levels.map((location, i) => {
                            const c = statusColor(location);
                            const pos = col.levels.length > 1 ? (i === 0 ? "Top" : "Bottom") : "";
                            return (
                              <div
                                key={location.id}
                                className="floorplan-tile"
                                style={{ borderColor: c.border, background: c.bg }}
                                title={location.fullLocationCode}
                              >
                                {pos && <span className="floorplan-tile-pos">{pos}</span>}
                                <span className="floorplan-tile-detail">
                                  {location.currentPallet
                                    ? location.currentPallet.sku?.partNumber ?? location.currentPallet.palletLicensePlate
                                    : "open"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="floorplan-bay-tiles">
                    {bayGroup.tiles.map((location) => {
                      const c = statusColor(location);
                      return (
                        <div
                          key={location.id}
                          className="floorplan-tile"
                          style={{ borderColor: c.border, background: c.bg }}
                          title={location.fullLocationCode}
                        >
                          <span className="floorplan-tile-code">{location.fullLocationCode}</span>
                          <span className="floorplan-tile-detail">
                            {location.currentPallet
                              ? location.currentPallet.sku?.partNumber ?? location.currentPallet.palletLicensePlate
                              : "Open"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
