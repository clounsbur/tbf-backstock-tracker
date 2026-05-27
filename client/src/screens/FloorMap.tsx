import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, type Location } from "../api/client";
import { PageHeader } from "../components/PageHeader";
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

      {!loading && !error && filteredLocations.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th>Area</th>
                <th>Status</th>
                <th>Home SKU</th>
                <th>Current Pallet</th>
                <th>Slot Rules</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocations.map((location) => (
                <tr key={location.id}>
                  <td>
                    <strong>{location.fullLocationCode}</strong>
                    <span className="subtle">
                      {location.zone} / Aisle {location.aisle} / Bay {location.bay} / Depth {location.depthPosition}
                    </span>
                  </td>
                  <td>
                    {location.area?.name}
                    {location.area?.areaType && <StatusBadge value={location.area.areaType} />}
                  </td>
                  <td>
                    <StatusBadge value={location.status} />
                  </td>
                  <td>{location.homeSku?.partNumber ?? "Unassigned"}</td>
                  <td>
                    {location.currentPallet ? (
                      <>
                        <strong>{location.currentPallet.palletLicensePlate}</strong>
                        <span className="subtle">{location.currentPallet.sku?.partNumber}</span>
                      </>
                    ) : (
                      "Open"
                    )}
                  </td>
                  <td>
                    <div className="rule-tags">
                      {location.isFrontHomeSlot && <span>Front home</span>}
                      {location.isFlexSlot && <span>Flex</span>}
                      {location.allowsOverflow && <span>Overflow OK</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
