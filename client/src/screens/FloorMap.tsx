import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, type Location } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { RecentMoves } from "../components/RecentMoves";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { StatusBadge } from "../components/StatusBadge";

export function FloorMap() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const areaTypes = useMemo(
    () => Array.from(new Set(locations.map((location) => location.area?.areaType).filter(Boolean))).sort(),
    [locations],
  );

  const statuses = useMemo(
    () => Array.from(new Set(locations.map((location) => location.status))).sort(),
    [locations],
  );

  const filteredLocations = locations.filter((location) => {
    const areaMatches = areaFilter === "ALL" || location.area?.areaType === areaFilter;
    const statusMatches = statusFilter === "ALL" || location.status === statusFilter;
    return areaMatches && statusMatches;
  });

  const groupedLocations = useMemo(() => groupLocations(filteredLocations), [filteredLocations]);

  const counts = useMemo(
    () => ({
      total: locations.length,
      occupied: locations.filter((location) => location.currentPallet).length,
      flex: locations.filter((location) => location.isFlexSlot).length,
      backstock: locations.filter((location) => location.area?.areaType === "BACKSTOCK").length,
    }),
    [locations],
  );

  return (
    <section>
      <PageHeader eyebrow="Floor Map" title="Live Location Status" />

      <div className="metric-row">
        <Metric label="Locations" value={counts.total} />
        <Metric label="Occupied" value={counts.occupied} />
        <Metric label="Flex Slots" value={counts.flex} />
        <Metric label="Backstock" value={counts.backstock} />
      </div>

      <div className="toolbar">
        <label>
          Area
          <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
            <option value="ALL">All areas</option>
            {areaTypes.map((areaType) => (
              <option key={areaType} value={areaType}>
                {areaType}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <button className="icon-button" type="button" onClick={() => void loadLocations()} title="Refresh locations">
          <RefreshCw size={18} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && filteredLocations.length === 0 && <EmptyBlock message="No locations match the current filters." />}

      {!loading && !error && groupedLocations.length > 0 && (
        <div className="floor-layout">
          <div className="area-stack">
            {groupedLocations.map((areaGroup) => (
              <section className="area-map" key={areaGroup.key}>
                <div className="area-map-header">
                  <div>
                    <h2>{areaGroup.name}</h2>
                    <p>{areaGroup.count} locations grouped by aisle, bay, and depth</p>
                  </div>
                  {areaGroup.areaType && <StatusBadge value={areaGroup.areaType} />}
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
                                <LocationTile key={location.id} location={location} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <RecentMoves />
        </div>
      )}
    </section>
  );
}

function LocationTile({ location }: { location: Location }) {
  return (
    <article className={`location-tile ${location.status.toLowerCase().replaceAll("_", "-")}`}>
      <div className="tile-topline">
        <strong>D{location.depthPosition}</strong>
        <StatusBadge value={location.status} />
      </div>
      <span className="tile-code">{location.fullLocationCode}</span>
      <span className="tile-detail">Home: {location.homeSku?.partNumber ?? "Unassigned"}</span>
      <span className="tile-detail">
        {location.currentPallet ? `${location.currentPallet.palletLicensePlate} / ${location.currentPallet.sku?.partNumber}` : "Open"}
      </span>
      <div className="rule-tags">
        {location.isFrontHomeSlot && <span>Home</span>}
        {location.isFlexSlot && <span>Flex</span>}
        {location.allowsOverflow && <span>Overflow OK</span>}
      </div>
    </article>
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
            .map(([bay, bayLocations]) => ({
              bay,
              locations: bayLocations.sort((a, b) => a.depthPosition - b.depthPosition),
            })),
        })),
    }));
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
