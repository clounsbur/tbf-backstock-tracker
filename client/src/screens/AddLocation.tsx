import { FormEvent, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { api, type AreaType, type WarehouseArea } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";

const AREA_TYPES: AreaType[] = ["BACKSTOCK", "FLEX_RESERVE", "OVERFLOW", "FRONT_HOME", "RECEIVING"];

export function AddLocation() {
  const [areas, setAreas] = useState<WarehouseArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [creatingArea, setCreatingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaType, setNewAreaType] = useState<AreaType>("BACKSTOCK");
  const [newAreaFloorStacked, setNewAreaFloorStacked] = useState(false);

  const [areaId, setAreaId] = useState("");
  const [zone, setZone] = useState("");
  const [aisle, setAisle] = useState("");
  const [bay, setBay] = useState("");
  const [level, setLevel] = useState("1");
  const [depthPosition, setDepthPosition] = useState(1);
  const [storageType, setStorageType] = useState<"PERMANENT" | "TEMPORARY">("PERMANENT");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadAreas() {
    setLoading(true);
    setLoadError(null);
    try {
      const { areas: loaded } = await api.listAreas();
      setAreas(loaded);
      if (!areaId && loaded.length) setAreaId(loaded[0].id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load areas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateArea(event: FormEvent) {
    event.preventDefault();
    if (!newAreaName.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const area = await api.createArea({
        name: newAreaName.trim(),
        areaType: newAreaType,
        isFloorStacked: newAreaFloorStacked,
      });
      setSuccess(`Added area "${area.name}".`);
      setNewAreaName("");
      setNewAreaFloorStacked(false);
      setCreatingArea(false);
      await loadAreas();
      setAreaId(area.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add area");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateLocation(event: FormEvent) {
    event.preventDefault();
    if (!areaId || !zone.trim() || !aisle.trim() || !bay.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const location = await api.createLocation({
        areaId,
        zone: zone.trim(),
        aisle: aisle.trim(),
        bay: bay.trim(),
        level: level.trim() || "1",
        depthPosition,
        storageType,
      });
      setSuccess(`Added ${storageType === "PERMANENT" ? "permanent" : "temporary"} location "${location.fullLocationCode}".`);
      setZone("");
      setAisle("");
      setBay("");
      setLevel("1");
      setDepthPosition(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add location");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <PageHeader eyebrow="Warehouse Setup" title="Add Storage Location" />

      {loading && <LoadingBlock />}
      {loadError && <ErrorBlock message={loadError} />}

      {!loading && !loadError && (
        <>
          {error && <ErrorBlock message={error} />}
          {success && <div className="state-block success">{success}</div>}

          <form className="panel form-panel" onSubmit={handleCreateLocation}>
            <h2>New location</h2>
            <p className="subtle">
              Permanent locations are reserved, standing storage. Temporary locations are marked
              overflow-capable so they only get used when a SKU's permanent slots are full.
            </p>

            <div className="form-grid">
              <label>
                Area
                <select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name} ({area.areaType})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Storage type
                <select
                  value={storageType}
                  onChange={(event) => setStorageType(event.target.value as "PERMANENT" | "TEMPORARY")}
                >
                  <option value="PERMANENT">Permanent</option>
                  <option value="TEMPORARY">Temporary (overflow-capable)</option>
                </select>
              </label>

              <label>
                Zone
                <input value={zone} onChange={(event) => setZone(event.target.value)} placeholder="e.g. SUP" />
              </label>

              <label>
                Aisle
                <input value={aisle} onChange={(event) => setAisle(event.target.value)} placeholder="e.g. 01" />
              </label>

              <label>
                Bay
                <input value={bay} onChange={(event) => setBay(event.target.value)} placeholder="e.g. 12" />
              </label>

              <label>
                Level
                <input value={level} onChange={(event) => setLevel(event.target.value)} placeholder="1" />
              </label>

              <label>
                Depth position
                <input
                  type="number"
                  min="1"
                  value={depthPosition}
                  onChange={(event) => setDepthPosition(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
            </div>

            <div className="button-row">
              <button type="submit" disabled={submitting || !areaId}>
                <MapPin size={18} aria-hidden="true" />
                {submitting ? "Adding..." : "Add location"}
              </button>
            </div>
          </form>

          <div className="panel form-panel">
            <div className="panel-heading">
              <h2>New area</h2>
              {!creatingArea && (
                <button type="button" className="secondary-button" onClick={() => setCreatingArea(true)}>
                  + New area
                </button>
              )}
            </div>

            {creatingArea && (
              <form onSubmit={handleCreateArea}>
                <div className="form-grid">
                  <label>
                    Name
                    <input value={newAreaName} onChange={(event) => setNewAreaName(event.target.value)} placeholder="e.g. Sturgeon" />
                  </label>
                  <label>
                    Area type
                    <select value={newAreaType} onChange={(event) => setNewAreaType(event.target.value as AreaType)}>
                      {AREA_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={newAreaFloorStacked}
                      onChange={(event) => setNewAreaFloorStacked(event.target.checked)}
                      style={{ marginRight: 8, width: "auto" }}
                    />
                    Floor-stacked (not racked)
                  </label>
                </div>
                <div className="button-row">
                  <button type="button" className="secondary-button" onClick={() => setCreatingArea(false)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting || !newAreaName.trim()}>
                    {submitting ? "Adding..." : "Add area"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </section>
  );
}
