import { FormEvent, useEffect, useMemo, useState } from "react";
import { MapPin, Save } from "lucide-react";
import { api, type AreaType, type Location, type LocationStatus, type WarehouseArea } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";

const AREA_TYPES: AreaType[] = ["BACKSTOCK", "FLEX_RESERVE", "OVERFLOW", "FRONT_HOME", "RECEIVING"];
const LOCATION_STATUSES: LocationStatus[] = [
  "OPEN",
  "OCCUPIED_HOME_SKU",
  "OCCUPIED_OVERFLOW_SKU",
  "RESERVED_HOME_SLOT",
  "OPEN_FLEX_SLOT",
  "BLOCKED",
];

type LocationEdits = Partial<{
  zone: string;
  aisle: string;
  bay: string;
  level: string;
  depthPosition: number;
  allowsOverflow: boolean;
  isFlexSlot: boolean;
  isShortenedHeight: boolean;
  status: LocationStatus;
}>;

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

  // -- edit existing area / its locations --
  const [editAreaId, setEditAreaId] = useState("");
  const [editAreaName, setEditAreaName] = useState("");
  const [editAreaType, setEditAreaType] = useState<AreaType>("BACKSTOCK");
  const [editAreaFloorStacked, setEditAreaFloorStacked] = useState(false);
  const [editAreaLastResort, setEditAreaLastResort] = useState(false);
  const [savingArea, setSavingArea] = useState(false);

  const [editLocations, setEditLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationEdits, setLocationEdits] = useState<Record<string, LocationEdits>>({});
  const [savingLocationId, setSavingLocationId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");

  // -- resize an area's permanent-location grid (add/remove aisle/bay/depth range) --
  const [resizeZone, setResizeZone] = useState("");
  const [resizeLevel, setResizeLevel] = useState("1");
  const [resizeAisleStart, setResizeAisleStart] = useState(1);
  const [resizeAisleEnd, setResizeAisleEnd] = useState(1);
  const [resizeBayStart, setResizeBayStart] = useState(1);
  const [resizeBayEnd, setResizeBayEnd] = useState(1);
  const [resizeDepthStart, setResizeDepthStart] = useState(1);
  const [resizeDepthEnd, setResizeDepthEnd] = useState(1);
  const [resizeAction, setResizeAction] = useState<"ADD" | "REMOVE">("ADD");
  const [resizePreview, setResizePreview] = useState<Awaited<ReturnType<typeof api.resizePermanentLocations>> | null>(null);
  const [resizing, setResizing] = useState(false);

  async function loadAreas() {
    setLoading(true);
    setLoadError(null);
    try {
      const { areas: loaded } = await api.listAreas();
      setAreas(loaded);
      if (!areaId && loaded.length) setAreaId(loaded[0].id);
      if (!editAreaId && loaded.length) selectEditArea(loaded[0]);
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

  function selectEditArea(area: WarehouseArea) {
    setEditAreaId(area.id);
    setEditAreaName(area.name);
    setEditAreaType(area.areaType);
    setEditAreaFloorStacked(Boolean(area.isFloorStacked));
    setEditAreaLastResort(Boolean(area.isLastResort));
    void loadAreaLocations(area.id);
  }

  async function loadAreaLocations(id: string) {
    setLoadingLocations(true);
    setLocationEdits({});
    setLocationFilter("");
    setResizePreview(null);
    try {
      const { locations } = await api.listAreaLocations(id);
      setEditLocations(locations);
      // Default the resize tool to a zone this area's permanent locations
      // actually use, so the dropdown below never starts empty.
      const permanentZone = locations.find((l) => !l.allowsOverflow)?.zone;
      setResizeZone(permanentZone ?? locations[0]?.zone ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load locations for that area");
    } finally {
      setLoadingLocations(false);
    }
  }

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
      if (areaId === editAreaId) void loadAreaLocations(areaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add location");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveArea(event: FormEvent) {
    event.preventDefault();
    if (!editAreaId) return;
    setSavingArea(true);
    setError(null);
    setSuccess(null);
    try {
      const area = await api.updateArea({
        id: editAreaId,
        name: editAreaName.trim() || undefined,
        areaType: editAreaType,
        isFloorStacked: editAreaFloorStacked,
        isLastResort: editAreaLastResort,
      });
      setSuccess(`Saved area "${area.name}".`);
      await loadAreas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save area");
    } finally {
      setSavingArea(false);
    }
  }

  function resizeRangeValid(): boolean {
    return (
      Boolean(editAreaId) &&
      Boolean(resizeZone.trim()) &&
      resizeAisleStart <= resizeAisleEnd &&
      resizeBayStart <= resizeBayEnd &&
      resizeDepthStart <= resizeDepthEnd
    );
  }

  async function handlePreviewResize() {
    if (!resizeRangeValid()) return;
    setResizing(true);
    setError(null);
    setResizePreview(null);
    try {
      const result = await api.resizePermanentLocations({
        areaId: editAreaId,
        zone: resizeZone.trim(),
        level: resizeLevel.trim() || "1",
        aisleStart: resizeAisleStart,
        aisleEnd: resizeAisleEnd,
        bayStart: resizeBayStart,
        bayEnd: resizeBayEnd,
        depthStart: resizeDepthStart,
        depthEnd: resizeDepthEnd,
        action: resizeAction,
        dryRun: true,
      });
      setResizePreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview resize");
    } finally {
      setResizing(false);
    }
  }

  async function handleConfirmResize() {
    if (!resizeRangeValid()) return;
    setResizing(true);
    setError(null);
    try {
      const result = await api.resizePermanentLocations({
        areaId: editAreaId,
        zone: resizeZone.trim(),
        level: resizeLevel.trim() || "1",
        aisleStart: resizeAisleStart,
        aisleEnd: resizeAisleEnd,
        bayStart: resizeBayStart,
        bayEnd: resizeBayEnd,
        depthStart: resizeDepthStart,
        depthEnd: resizeDepthEnd,
        action: resizeAction,
        dryRun: false,
      });
      setSuccess(
        resizeAction === "ADD"
          ? `Added ${result.added} location(s).`
          : `Removed ${result.removed} empty location(s).${result.skippedOccupied ? ` Skipped ${result.skippedOccupied} occupied.` : ""}`,
      );
      setResizePreview(null);
      await loadAreaLocations(editAreaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply resize");
    } finally {
      setResizing(false);
    }
  }

  function editValue<K extends keyof LocationEdits>(loc: Location, key: K): LocationEdits[K] {
    const edited = locationEdits[loc.id]?.[key];
    if (edited !== undefined) return edited;
    switch (key) {
      case "zone": return loc.zone as LocationEdits[K];
      case "aisle": return loc.aisle as LocationEdits[K];
      case "bay": return loc.bay as LocationEdits[K];
      case "level": return loc.level as LocationEdits[K];
      case "depthPosition": return loc.depthPosition as LocationEdits[K];
      case "allowsOverflow": return loc.allowsOverflow as LocationEdits[K];
      case "isFlexSlot": return loc.isFlexSlot as LocationEdits[K];
      case "isShortenedHeight": return loc.isShortenedHeight as LocationEdits[K];
      case "status": return loc.status as LocationEdits[K];
      default: return undefined as LocationEdits[K];
    }
  }

  function setEdit<K extends keyof LocationEdits>(id: string, key: K, value: LocationEdits[K]) {
    setLocationEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }

  function isDirty(id: string): boolean {
    const edits = locationEdits[id];
    return Boolean(edits && Object.keys(edits).length > 0);
  }

  async function handleSaveLocation(loc: Location) {
    const edits = locationEdits[loc.id];
    if (!edits) return;
    setSavingLocationId(loc.id);
    setError(null);
    try {
      const updated = await api.updateLocation({ id: loc.id, ...edits });
      setEditLocations((prev) => prev.map((l) => (l.id === loc.id ? updated : l)));
      setLocationEdits((prev) => {
        const next = { ...prev };
        delete next[loc.id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save location");
    } finally {
      setSavingLocationId(null);
    }
  }

  const filteredLocations = useMemo(() => {
    const term = locationFilter.trim().toLowerCase();
    if (!term) return editLocations;
    return editLocations.filter((l) => l.fullLocationCode.toLowerCase().includes(term));
  }, [editLocations, locationFilter]);

  // Zones actually used by this area's permanent (non-overflow) locations --
  // picking from this instead of free-typing a zone prevents attaching a
  // typo'd or wrong-area zone code (e.g. "WF" ending up under Superior).
  const permanentZonesForEditArea = useMemo(() => {
    const zones = new Set(editLocations.filter((l) => !l.allowsOverflow).map((l) => l.zone));
    return Array.from(zones).sort();
  }, [editLocations]);

  return (
    <section>
      <PageHeader eyebrow="Warehouse Setup" title="Manage Storage Locations" />

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

          <div className="panel form-panel">
            <h2>Edit existing area</h2>
            <p className="subtle">
              Change an area's name, type, or flags, and fix up individual locations below — depth,
              overflow/flex capability, shortened-height, or status.
            </p>

            <form onSubmit={handleSaveArea}>
              <div className="form-grid">
                <label>
                  Area
                  <select
                    value={editAreaId}
                    onChange={(event) => {
                      const area = areas.find((a) => a.id === event.target.value);
                      if (area) selectEditArea(area);
                    }}
                  >
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name} ({area.areaType})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Name
                  <input value={editAreaName} onChange={(event) => setEditAreaName(event.target.value)} />
                </label>

                <label>
                  Area type
                  <select value={editAreaType} onChange={(event) => setEditAreaType(event.target.value as AreaType)}>
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
                    checked={editAreaFloorStacked}
                    onChange={(event) => setEditAreaFloorStacked(event.target.checked)}
                    style={{ marginRight: 8, width: "auto" }}
                  />
                  Floor-stacked (not racked)
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={editAreaLastResort}
                    onChange={(event) => setEditAreaLastResort(event.target.checked)}
                    style={{ marginRight: 8, width: "auto" }}
                  />
                  Last resort (global overflow only)
                </label>
              </div>

              <div className="button-row">
                <button type="submit" disabled={savingArea || !editAreaId}>
                  <Save size={18} aria-hidden="true" />
                  {savingArea ? "Saving..." : "Save area"}
                </button>
              </div>
            </form>

            <div className="search-bar" style={{ marginTop: 16 }}>
              <input
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
                placeholder="Filter locations by code (e.g. SUP-19)"
              />
            </div>

            {loadingLocations && <LoadingBlock />}

            {!loadingLocations && editLocations.length > 0 && (
              <div className="table-wrap tall" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Zone</th>
                      <th>Aisle</th>
                      <th>Bay</th>
                      <th>Level</th>
                      <th>Depth</th>
                      <th>Overflow</th>
                      <th>Flex</th>
                      <th>Short</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLocations.map((loc) => (
                      <tr key={loc.id}>
                        <td>
                          <strong>{loc.fullLocationCode}</strong>
                        </td>
                        <td>
                          <input
                            value={editValue(loc, "zone") as string}
                            onChange={(event) => setEdit(loc.id, "zone", event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            value={editValue(loc, "aisle") as string}
                            onChange={(event) => setEdit(loc.id, "aisle", event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            value={editValue(loc, "bay") as string}
                            onChange={(event) => setEdit(loc.id, "bay", event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            value={editValue(loc, "level") as string}
                            onChange={(event) => setEdit(loc.id, "level", event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={editValue(loc, "depthPosition") as number}
                            onChange={(event) => setEdit(loc.id, "depthPosition", Math.max(1, Number(event.target.value) || 1))}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={editValue(loc, "allowsOverflow") as boolean}
                            onChange={(event) => setEdit(loc.id, "allowsOverflow", event.target.checked)}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={editValue(loc, "isFlexSlot") as boolean}
                            onChange={(event) => setEdit(loc.id, "isFlexSlot", event.target.checked)}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={editValue(loc, "isShortenedHeight") as boolean}
                            onChange={(event) => setEdit(loc.id, "isShortenedHeight", event.target.checked)}
                          />
                        </td>
                        <td>
                          <select
                            value={editValue(loc, "status") as string}
                            onChange={(event) => setEdit(loc.id, "status", event.target.value as LocationStatus)}
                          >
                            {LOCATION_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={!isDirty(loc.id) || savingLocationId === loc.id}
                            onClick={() => handleSaveLocation(loc)}
                          >
                            {savingLocationId === loc.id ? "..." : "Save"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loadingLocations && editLocations.length === 0 && (
              <p className="subtle" style={{ marginTop: 12 }}>
                No locations in this area yet.
              </p>
            )}
          </div>

          <div className="panel form-panel">
            <h2>Resize permanent locations</h2>
            <p className="subtle">
              Add or remove whole ranges of aisles, bays, or depth positions for the area selected
              above ({areas.find((a) => a.id === editAreaId)?.name ?? "none"}). Only permanent
              (non-overflow) locations are affected, and nothing occupied is ever removed.
            </p>

            <div className="form-grid">
              <label>
                Zone code
                {permanentZonesForEditArea.length > 0 ? (
                  <select value={resizeZone} onChange={(event) => setResizeZone(event.target.value)}>
                    {permanentZonesForEditArea.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={resizeZone}
                    onChange={(event) => setResizeZone(event.target.value)}
                    placeholder="e.g. SUP"
                  />
                )}
              </label>

              <label>
                Level
                <input value={resizeLevel} onChange={(event) => setResizeLevel(event.target.value)} placeholder="1" />
              </label>

              <label>
                Aisle range
                <div className="button-row" style={{ marginTop: 0 }}>
                  <input
                    type="number"
                    min="1"
                    value={resizeAisleStart}
                    onChange={(event) => setResizeAisleStart(Math.max(1, Number(event.target.value) || 1))}
                  />
                  <span className="subtle" style={{ alignSelf: "center" }}>to</span>
                  <input
                    type="number"
                    min="1"
                    value={resizeAisleEnd}
                    onChange={(event) => setResizeAisleEnd(Math.max(1, Number(event.target.value) || 1))}
                  />
                </div>
              </label>

              <label>
                Bay range
                <div className="button-row" style={{ marginTop: 0 }}>
                  <input
                    type="number"
                    min="1"
                    value={resizeBayStart}
                    onChange={(event) => setResizeBayStart(Math.max(1, Number(event.target.value) || 1))}
                  />
                  <span className="subtle" style={{ alignSelf: "center" }}>to</span>
                  <input
                    type="number"
                    min="1"
                    value={resizeBayEnd}
                    onChange={(event) => setResizeBayEnd(Math.max(1, Number(event.target.value) || 1))}
                  />
                </div>
              </label>

              <label>
                Depth range
                <div className="button-row" style={{ marginTop: 0 }}>
                  <input
                    type="number"
                    min="1"
                    value={resizeDepthStart}
                    onChange={(event) => setResizeDepthStart(Math.max(1, Number(event.target.value) || 1))}
                  />
                  <span className="subtle" style={{ alignSelf: "center" }}>to</span>
                  <input
                    type="number"
                    min="1"
                    value={resizeDepthEnd}
                    onChange={(event) => setResizeDepthEnd(Math.max(1, Number(event.target.value) || 1))}
                  />
                </div>
              </label>

              <label>
                Action
                <select
                  value={resizeAction}
                  onChange={(event) => {
                    setResizeAction(event.target.value as "ADD" | "REMOVE");
                    setResizePreview(null);
                  }}
                >
                  <option value="ADD">Add missing locations in this range</option>
                  <option value="REMOVE">Remove empty locations in this range</option>
                </select>
              </label>
            </div>

            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                disabled={resizing || !resizeRangeValid()}
                onClick={handlePreviewResize}
              >
                {resizing ? "Checking..." : "Preview"}
              </button>

              {resizePreview && resizeAction === "ADD" && (
                <button type="button" disabled={resizing || resizePreview.wouldAdd === 0} onClick={handleConfirmResize}>
                  {resizing ? "Adding..." : `Add ${resizePreview.wouldAdd} location(s)`}
                </button>
              )}

              {resizePreview && resizeAction === "REMOVE" && (
                <button type="button" disabled={resizing || resizePreview.wouldRemove === 0} onClick={handleConfirmResize}>
                  {resizing ? "Removing..." : `Remove ${resizePreview.wouldRemove} empty location(s)`}
                </button>
              )}
            </div>

            {!resizePreview && !resizeZone.trim() && (
              <p className="subtle">Enter a zone code above, then click Preview.</p>
            )}

            {resizePreview && (
              <p className="subtle">
                {resizeAction === "ADD"
                  ? `${resizePreview.wouldAdd} location(s) would be added.`
                  : `${resizePreview.wouldRemove} empty location(s) would be removed.${
                      resizePreview.skippedOccupied
                        ? ` ${resizePreview.skippedOccupied} location(s) in range are occupied and will be left alone.`
                        : ""
                    }`}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
