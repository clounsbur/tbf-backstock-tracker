import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, RefreshCw, Search } from "lucide-react";
import { api, type Location, type Sku } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { RecentMoves } from "../components/RecentMoves";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { locationStatusLabel } from "../components/StatusBadge";
import { floorPositionLabel, rackPositionLabel } from "../components/rackPosition";

const AREA_TINTS: Record<string, { bg: string; border: string }> = {
  Superior: { bg: "#eef2ff", border: "#8b9cf6" },
  Potawatomi: { bg: "#ffe7d1", border: "#fb923c" },
  "Soo Locks": { bg: "#d8f0fd", border: "#38bdf8" },
  Huron: { bg: "#d5f7ec", border: "#34d399" },
  Erie: { bg: "#f0e2ff", border: "#c084fc" },
  Michigan: { bg: "#fdf3c4", border: "#eab308" },
  Ontario: { bg: "#fcdada", border: "#ef4444" },
  Whitefish: { bg: "#e2e8f0", border: "#64748b" },
};

type QuickFilter = "ALL" | "BACKSTOCK" | "OVERFLOW" | "OPEN_ONLY";

function isLocationOpen(location: Location): boolean {
  return location.status !== "BLOCKED" && !location.currentPallet;
}

function statusDotColor(location: Location): string | null {
  if (isLocationOpen(location)) return null;
  switch (location.status) {
    case "OCCUPIED_HOME_SKU":
      return "#1D9E75";
    case "OCCUPIED_OVERFLOW_SKU":
      return "#EF9F27";
    case "RESERVED_HOME_SLOT":
    case "OPEN_FLEX_SLOT":
      return "#2563EB";
    case "BLOCKED":
      return "#E24B4A";
    default:
      return location.currentPallet ? "#1D9E75" : null;
  }
}

function statusLine(location: Location): { text: string; tone: "default" | "amber" | "red" } {
  if (location.status === "BLOCKED") return { text: "Blocked", tone: "red" };
  if (isLocationOpen(location)) return { text: "Open", tone: "default" };
  if (location.currentPallet) {
    const lp = location.currentPallet.palletLicensePlate;
    const part = location.currentPallet.sku?.partNumber;
    const label = part ? `${lp} · ${part}` : lp;
    if (location.status === "OCCUPIED_OVERFLOW_SKU") return { text: `Overflow · ${label}`, tone: "amber" };
    return { text: label, tone: "default" };
  }
  return { text: "Reserved", tone: "default" };
}

function relativeTime(from: number | null): string {
  if (!from) return "";
  const seconds = Math.round((Date.now() - from) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function FloorMap() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const areaRefs = useRef<Record<string, HTMLElement | null>>({});

  const [skuQuery, setSkuQuery] = useState("");
  const [searchSku, setSearchSku] = useState<Sku | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  function jumpToArea(key: string) {
    areaRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSkuSearch(event: FormEvent) {
    event.preventDefault();
    const term = skuQuery.trim();
    if (!term) return;
    setSearching(true);
    setSearchError(null);
    try {
      const response = await api.searchSkus(term);
      const sku =
        response.skus.find((candidate) => candidate.partNumber.toLowerCase() === term.toLowerCase()) ??
        response.skus[0] ??
        null;
      if (!sku) {
        setSearchSku(null);
        setSearchError(`No SKU found for "${term}".`);
        return;
      }
      setSearchSku(sku);
      // A search should always be able to show its results on the map, even
      // if the current filters would otherwise hide the matching locations.
      setQuickFilter("ALL");
      setStatusFilter("ALL");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setSearchSku(null);
    } finally {
      setSearching(false);
    }
  }

  function clearSkuSearch() {
    setSkuQuery("");
    setSearchSku(null);
    setSearchError(null);
  }

  const searchHomeLocationIds = useMemo(
    () => new Set((searchSku?.homeLocations ?? []).map((l) => l.id)),
    [searchSku],
  );
  const searchPalletLocationIds = useMemo(
    () =>
      new Set(
        (searchSku?.pallets ?? [])
          .filter((p) => p.status !== "CONSUMED" && p.currentLocation)
          .map((p) => p.currentLocation!.id),
      ),
    [searchSku],
  );
  const searchAreas = useMemo(() => {
    if (!searchSku) return [];
    const byArea = new Map<string, { key: string; name: string; units: number }>();
    for (const p of searchSku.pallets ?? []) {
      if (p.status === "CONSUMED" || !p.currentLocation) continue;
      const key = p.currentLocation.areaId;
      const name = p.currentLocation.area?.name ?? "Unknown area";
      const entry = byArea.get(key) ?? { key, name, units: 0 };
      entry.units += p.quantity;
      byArea.set(key, entry);
    }
    return Array.from(byArea.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [searchSku]);
  const searchTotalUnits = useMemo(() => searchAreas.reduce((sum, a) => sum + a.units, 0), [searchAreas]);

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
      setLastLoadedAt(Date.now());
    }
  }

  useEffect(() => {
    void loadLocations();
  }, []);

  // Re-render the "updated Xm ago" stamp once a minute.
  useEffect(() => {
    const interval = window.setInterval(() => forceTick((value) => value + 1), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    // The whole document scrolls via the window (.content has no overflow scroller),
    // but check both to be safe across layouts.
    const getY = () =>
      window.scrollY ||
      document.documentElement.scrollTop ||
      (document.querySelector(".content") as HTMLElement | null)?.scrollTop ||
      0;
    const onScroll = () => setShowTop(getY() > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    const contentEl = document.querySelector(".content");
    contentEl?.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      contentEl?.removeEventListener("scroll", onScroll);
    };
  }, []);
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.documentElement.scrollTo?.({ top: 0, behavior: "smooth" });
    (document.querySelector(".content") as HTMLElement | null)?.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  const statuses = useMemo(
    () => Array.from(new Set(locations.map((location) => location.status))).sort(),
    [locations],
  );

  const filteredLocations = locations.filter((location) => {
    const quickMatches =
      quickFilter === "ALL" ||
      (quickFilter === "BACKSTOCK" && location.area?.areaType === "BACKSTOCK") ||
      (quickFilter === "OVERFLOW" && location.area?.areaType === "OVERFLOW") ||
      (quickFilter === "OPEN_ONLY" && isLocationOpen(location));
    const statusMatches = statusFilter === "ALL" || location.status === statusFilter;
    return quickMatches && statusMatches;
  });

  const groupedLocations = useMemo(() => groupLocations(filteredLocations), [filteredLocations]);

  const counts = useMemo(() => {
    const total = locations.length;
    const occupied = locations.filter((location) => location.currentPallet).length;
    return {
      total,
      occupied,
      utilizationPct: total ? Math.round((occupied / total) * 100) : 0,
      overflow: locations.filter(
        (location) => location.area?.areaType === "OVERFLOW" && location.currentPallet,
      ).length,
      blocked: locations.filter((location) => location.status === "BLOCKED").length,
    };
  }, [locations]);

  const quickFilters: Array<{ key: QuickFilter; label: string }> = [
    { key: "ALL", label: "All areas" },
    { key: "BACKSTOCK", label: "Backstock" },
    { key: "OVERFLOW", label: "Overflow" },
    { key: "OPEN_ONLY", label: "Open only" },
  ];

  return (
    <section>
      <PageHeader eyebrow="Floor Map" title="Live Location Status" />

      <form className="search-bar" onSubmit={handleSkuSearch}>
        <input
          value={skuQuery}
          onChange={(event) => setSkuQuery(event.target.value)}
          placeholder="Search SKU, part number, or description to find it on the map"
        />
        <button type="submit" disabled={searching}>
          <Search size={18} aria-hidden="true" />
          {searching ? "Searching..." : "Search"}
        </button>
        {(searchSku || searchError) && (
          <button type="button" className="secondary-button" onClick={clearSkuSearch}>
            Clear
          </button>
        )}
      </form>

      {searchError && <ErrorBlock message={searchError} />}

      {searchSku && (
        <div className={`floorplan-banner${searchAreas.length ? "" : " empty"}`} style={{ flexWrap: "wrap" }}>
          <span>
            <strong>
              {searchSku.partNumber} - {searchSku.description}
            </strong>
            {searchAreas.length > 0 && <> : {searchTotalUnits} units highlighted below</>}
            {searchAreas.length === 0 && searchHomeLocationIds.size === 0 && " - no stock and no home slots assigned."}
            {searchAreas.length === 0 &&
              searchHomeLocationIds.size > 0 &&
              ` - no stock currently in backstock, but ${searchHomeLocationIds.size} home slot${searchHomeLocationIds.size > 1 ? "s are" : " is"} outlined in blue below.`}
          </span>
          {searchAreas.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {searchAreas.map((a) => (
                <button key={a.key} type="button" onClick={() => jumpToArea(a.key)}>
                  {a.name} ({a.units})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="metric-row">
        <Metric label="Locations" value={counts.total} />
        <Metric label="Occupied" value={counts.occupied} suffix={`${counts.utilizationPct}%`} />
        <Metric label="Overflow" value={counts.overflow} tone={counts.overflow > 0 ? "amber" : "neutral"} />
        <Metric label="Blocked" value={counts.blocked} tone={counts.blocked > 0 ? "red" : "neutral"} />
      </div>

      <div className="toolbar">
        <div className="filter-pills" role="group" aria-label="Quick filters">
          {quickFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`pill${quickFilter === filter.key ? " active" : ""}`}
              aria-pressed={quickFilter === filter.key}
              onClick={() => setQuickFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <label className="status-select">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {locationStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>

        <div className="toolbar-meta">
          <span className="updated-stamp">{lastLoadedAt ? `Updated ${relativeTime(lastLoadedAt)}` : ""}</span>
          <button className="icon-button" type="button" onClick={() => void loadLocations()} title="Refresh locations" aria-label="Refresh locations">
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {!loading && !error && groupedLocations.length > 1 && (
        <nav className="area-jump" aria-label="Jump to area">
          {groupedLocations.map((areaGroup) => (
            <button
              key={areaGroup.key}
              type="button"
              className="area-jump-pill"
              onClick={() => jumpToArea(areaGroup.key)}
            >
              {AREA_TINTS[areaGroup.name] && (
                <span
                  className="area-jump-dot"
                  style={{ background: AREA_TINTS[areaGroup.name].border }}
                  aria-hidden="true"
                />
              )}
              {areaGroup.name}
              <span className="area-jump-count">{areaGroup.count}</span>
            </button>
          ))}
        </nav>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && filteredLocations.length === 0 && <EmptyBlock message="No locations match the current filters." />}

      {!loading && !error && groupedLocations.length > 0 && (
        <div className="floor-layout">
          <div className="area-stack">
            {groupedLocations.map((areaGroup) => (
              <section
                className="area-map"
                key={areaGroup.key}
                ref={(el) => {
                  areaRefs.current[areaGroup.key] = el;
                }}
                style={
                  AREA_TINTS[areaGroup.name]
                    ? { borderTop: `4px solid ${AREA_TINTS[areaGroup.name].border}` }
                    : undefined
                }
              >
                <div
                  className="area-map-header"
                  style={
                    AREA_TINTS[areaGroup.name]
                      ? { background: AREA_TINTS[areaGroup.name].bg, margin: "-14px -14px 12px", padding: "12px 14px", borderRadius: "8px 8px 0 0" }
                      : undefined
                  }
                >
                  <div>
                    <h2>{areaGroup.name}</h2>
                    <p>{areaGroup.count} locations grouped by aisle, bay, and depth</p>
                  </div>
                </div>

                <div className="aisle-stack">
                  {areaGroup.aisles.map((aisleGroup) => (
                    <div className="aisle-group" key={aisleGroup.aisle}>
                      <h3>Aisle {aisleGroup.aisle}</h3>
                      <div className="bay-stack">
                        {aisleGroup.bays.map((bayGroup) => (
                          <div className="bay-row" key={bayGroup.bay}>
                            <div className="bay-label">Bay {bayGroup.bay}</div>
                            <div className="depth-grid">
                              {bayGroup.locations.map((location) => (
                                <LocationTile
                                  key={location.id}
                                  location={location}
                                  maxSlotRow={bayGroup.maxSlotRow}
                                  maxSlotCol={bayGroup.maxSlotCol}
                                  bayLocations={bayGroup.locations}
                                  searchMatch={
                                    searchPalletLocationIds.has(location.id)
                                      ? "pallet"
                                      : searchHomeLocationIds.has(location.id)
                                        ? "home"
                                        : null
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <LocationLegend />
              </section>
            ))}
          </div>
          <RecentMoves />
        </div>
      )}

      {showTop && (
        <button type="button" className="scroll-top" onClick={scrollToTop} aria-label="Scroll back to top">
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

function LocationTile({
  location,
  maxSlotRow,
  maxSlotCol,
  bayLocations,
  searchMatch,
}: {
  location: Location;
  maxSlotRow: number;
  maxSlotCol: number;
  bayLocations: Location[];
  searchMatch?: "pallet" | "home" | null;
}) {
  const open = isLocationOpen(location);
  const dot = statusDotColor(location);
  const line = statusLine(location);
  const posLabel = rackPositionLabel(location, maxSlotRow, maxSlotCol) ?? floorPositionLabel(location, bayLocations);

  return (
    <article
      className={`location-tile ${location.status.toLowerCase().replaceAll("_", "-")}${open ? " open" : ""}${location.isShortenedHeight ? " short" : ""}${searchMatch ? ` search-match-${searchMatch}` : ""}`}
      title={location.isShortenedHeight ? "Shortened height — last-resort slot" : undefined}
    >
      <div className="tile-topline">
        <strong>{posLabel}</strong>
        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {location.isShortenedHeight && <span className="short-flag" aria-label="Shortened height">↧</span>}
          {dot && <span className="status-dot" style={{ background: dot }} aria-hidden="true" />}
        </span>
      </div>
      <span className="tile-code">{location.fullLocationCode}</span>
      <span className={`tile-status tone-${line.tone}`}>{line.text}</span>
    </article>
  );
}

const LEGEND_ITEMS: Array<{ label: string; color: string; dashed?: boolean; short?: boolean }> = [
  { label: "Home SKU", color: "#1D9E75" },
  { label: "Overflow", color: "#EF9F27" },
  { label: "Reserved / flex", color: "#2563EB" },
  { label: "Blocked", color: "#E24B4A" },
  { label: "Open", color: "transparent", dashed: true },
  { label: "↧ short (last resort)", color: "#EF9F27", short: true },
];

function LocationLegend() {
  return (
    <div className="tile-legend">
      {LEGEND_ITEMS.map((item) => (
        <span key={item.label} className="legend-item">
          {item.short ? (
            <span className="short-flag" aria-hidden="true">↧</span>
          ) : (
            <span
              className={`legend-dot${item.dashed ? " dashed" : ""}`}
              style={item.dashed ? undefined : { background: item.color }}
              aria-hidden="true"
            />
          )}
          {item.label.replace("↧ ", "")}
        </span>
      ))}
    </div>
  );
}

function groupLocations(locations: Location[]) {
  const areaMap = new Map<
    string,
    {
      key: string;
      name: string;
      areaType?: string;
      sortOrder: number;
      count: number;
      aisleMap: Map<string, Map<string, Location[]>>;
    }
  >();

  for (const location of locations) {
    const areaKey = location.area?.id ?? "unassigned";
    if (!areaMap.has(areaKey)) {
      areaMap.set(areaKey, {
        key: areaKey,
        name: location.area?.name ?? "Unassigned Area",
        areaType: location.area?.areaType,
        sortOrder: location.area?.sortOrder ?? 999,
        count: 0,
        aisleMap: new Map(),
      });
    }

    const area = areaMap.get(areaKey);
    if (!area) continue;
    area.count += 1;

    if (!area.aisleMap.has(location.aisle)) {
      area.aisleMap.set(location.aisle, new Map());
    }

    const bayMap = area.aisleMap.get(location.aisle);
    if (!bayMap) continue;

    if (!bayMap.has(location.bay)) {
      bayMap.set(location.bay, []);
    }

    bayMap.get(location.bay)?.push(location);
  }

  return Array.from(areaMap.values())
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((area) => ({
      key: area.key,
      name: area.name,
      areaType: area.areaType,
      count: area.count,
      aisles: Array.from(area.aisleMap.entries())
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([aisle, bayMap]) => ({
          aisle,
          bays: Array.from(bayMap.entries())
            .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
            .map(([bay, bayLocations]) => {
              const rows = bayLocations.map((l) => l.slotRow).filter((r): r is number => r != null);
              const cols = bayLocations.map((l) => l.slotCol).filter((c): c is number => c != null);
              return {
                bay,
                locations: bayLocations.sort((a, b) => a.depthPosition - b.depthPosition),
                maxSlotRow: rows.length ? Math.max(...rows) : 0,
                maxSlotCol: cols.length ? Math.max(...cols) : 0,
              };
            }),
        })),
    }));
}

function Metric({
  label,
  value,
  suffix,
  tone = "neutral",
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: "neutral" | "amber" | "red";
}) {
  return (
    <div className={`metric tone-${tone}`}>
      <span>{label}</span>
      <strong>
        {value}
        {suffix && <em className="metric-suffix">{suffix}</em>}
      </strong>
    </div>
  );
}
