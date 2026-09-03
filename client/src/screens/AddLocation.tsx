import { FormEvent, useEffect, useMemo, useState } from "react";
import { MapPin, Save } from "lucide-react";
import { api, type AreaType, type Location, type LocationStatus, type WarehouseArea } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { locationStatusLabel } from "../components/StatusBadge";

const AREA_TYPES: AreaType[] = ["BACKSTOCK", "FLEX_RESERVE", "OVERFLOW", "FRONT_HOME", "RECEIVING"];
const LOCATION_STATUSES: LocationStatus[] = [
  "OPEN",
  "OCCUPIED_HOME_SKU",
  "OCCUPIED_OVERFLOW_SKU",
  "RESERVED_HOME_SLOT",
  "OPEN_FLEX_SLOT",
  "BLOCKED",
];

type Tab = "add-location" | "edit-area" | "resize" | "add-area";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "add-location", label: "Add Location" },
  { key: "edit-area", label: "Edit Area" },
  { key: "resize", label: "Resize Grid" },
  { key: "add-area", label: "Add Area" },
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

// One-level undo for whatever the most recent mutating action on this page
// was. Each variant carries exactly what's needed to reverse itself; see
// handleUndo below for how each one is played back.
type UndoAction =
  | { kind: "location-created"; id: string; code: string }
  | { kind: "area-created"; id: string; name: string }
  | { kind: "area-updated"; id: string; name: string; previous: { name: string; areaType: AreaType; isFloorStacked: boolean; isLastResort: boolean } }
  | { kind: "location-updated"; id: string; code: string; previous: LocationEdits }
  | { kind: "resize-added"; ids: string[]; count: number };

export function AddLocation() {
  const [activeTab, setActiveTab] = useState<Tab>("add-location");
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [undoing, setUndoing] = useState(false);

  const [areas, setAreas] = useState<WarehouseArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // -- one shared area selection + its locations, used by Add Location,
  // Edit Area, and Resize Grid so picking an area in one tab carries over. --
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [areaLocations, setAreaLocations] = useState<Location[]>([]);
  const [loadingAreaLocations, setLoadingAreaLocations] = useState(false);

  const [editAreaName, setEditAreaName] = useState("");
  const [editAreaType, setEditAreaType] = useState<AreaType>("BACKSTOCK");
  const [editAreaFloorStacked, setEditAreaFloorStacked] = useState(false);
  const [editAreaLastResort, setEditAreaLastResort] = useState(false);
  const [savingArea, setSavingArea] = useState(false);

  const [locationEdits, setLocationEdits] = useState<Record<string, LocationEdits>>({});
  const [savingLocationId, setSavingLocationId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");

  // -- add a single new location --
  const [manualZone, setManualZone] = useState("");
  const [aisle, setAisle] = useState("");
  const [bay, setBay] = useState("");
  const [level, setLevel] = useState("1");
  const [depthPosition, setDepthPosition] = useState(1);
  const [storageType, setStorageType] = useState<"PERMANENT" | "TEMPORARY">("PERMANENT");

  // -- add a brand new area --
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaType, setNewAreaType] = useState<AreaType>("BACKSTOCK");
  const [newAreaFloorStacked, setNewAreaFloorStacked] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // -- resize an area's permanent-location grid (add/remove aisle/bay/level/depth range) --
  const [resizeLevelStart, setResizeLevelStart] = useState(1);
  const [resizeLevelEnd, setResizeLevelEnd] = useState(1);
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
      if (!selectedAreaId && loaded.length) selectArea(loaded[0]);
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

  function selectArea(area: WarehouseArea) {
    setSelectedAreaId(area.id);
    setEditAreaName(area.name);
    setEditAreaType(area.areaType);
    setEditAreaFloorStacked(Boolean(area.isFloorStacked));
    setEditAreaLastResort(Boolean(area.isLastResort));
    void loadAreaLocations(area.id);
  }

  async function loadAreaLocations(id: string) {
    setLoadingAreaLocations(true);
    setLocationEdits({});
    setLocationFilter("");
    setResizePreview(null);
    try {
      const { locations } = await api.listAreaLocations(id);
      setAreaLocations(locations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load locations for that area");
    } finally {
      setLoadingAreaLocations(false);
    }
  }

  // Every code prefix this area's locations already use. When there's
  // exactly one (the normal case), it's used automatically -- nobody adding
  // a location or resizing a grid should have to know or type it. It's only
  // ever shown as a fallback when an area is brand new or genuinely mixed.
  const areaZones = useMemo(() => {
    const zones = new Set(areaLocations.map((l) => l.zone));
    return Array.from(zones).sort();
  }, [areaLocations]);
  const permanentZones = useMemo(() => {
    const zones = new Set(areaLocations.filter((l) => !l.allowsOverflow).map((l) => l.zone));
    return Array.from(zones).sort();
  }, [areaLocations]);

  const selectedArea = areas.find((a) => a.id === selectedAreaId);
  const newLocationZone = areaZones.length === 1 ? areaZones[0] : manualZone.trim();
  const resizeZone = permanentZones.length === 1 ? permanentZones[0] : manualZone.trim();

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
      setUndoAction({ kind: "area-created", id: area.id, name: area.name });
      setNewAreaName("");
      setNewAreaFloorStacked(false);
      await loadAreas();
      selectArea(area);
      setActiveTab("add-location");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add area");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateLocation(event: FormEvent) {
    event.preventDefault();
    if (!selectedAreaId || !newLocationZone || !aisle.trim() || !bay.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const location = await api.createLocation({
        areaId: selectedAreaId,
        zone: newLocationZone,
        aisle: aisle.trim(),
        bay: bay.trim(),
        level: level.trim() || "1",
        depthPosition,
        storageType,
      });
      setSuccess(`Added ${storageType === "PERMANENT" ? "permanent" : "temporary"} location "${location.fullLocationCode}".`);
      setUndoAction({ kind: "location-created", id: location.id, code: location.fullLocationCode });
      setAisle("");
      setBay("");
      setLevel("1");
      setDepthPosition(1);
      void loadAreaLocations(selectedAreaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add location");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveArea(event: FormEvent) {
    event.preventDefault();
    if (!selectedAreaId) return;
    const before = areas.find((a) => a.id === selectedAreaId);
    setSavingArea(true);
    setError(null);
    setSuccess(null);
    try {
      const area = await api.updateArea({
        id: selectedAreaId,
        name: editAreaName.trim() || undefined,
        areaType: editAreaType,
        isFloorStacked: editAreaFloorStacked,
        isLastResort: editAreaLastResort,
      });
      setSuccess(`Saved area "${area.name}".`);
      if (before) {
        setUndoAction({
          kind: "area-updated",
          id: selectedAreaId,
          name: area.name,
          previous: {
            name: before.name,
            areaType: before.areaType,
            isFloorStacked: Boolean(before.isFloorStacked),
            isLastResort: Boolean(before.isLastResort),
          },
        });
      }
      await loadAreas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save area");
    } finally {
      setSavingArea(false);
    }
  }

  function resizeRangeValid(): boolean {
    return (
      Boolean(selectedAreaId) &&
      Boolean(resizeZone) &&
      resizeAisleStart <= resizeAisleEnd &&
      resizeBayStart <= resizeBayEnd &&
      resizeLevelStart <= resizeLevelEnd &&
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
        areaId: selectedAreaId,
        zone: resizeZone,
        levelStart: resizeLevelStart,
        levelEnd: resizeLevelEnd,
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
        areaId: selectedAreaId,
        zone: resizeZone,
        levelStart: resizeLevelStart,
        levelEnd: resizeLevelEnd,
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
      if (resizeAction === "ADD" && result.addedIds.length > 0) {
        setUndoAction({ kind: "resize-added", ids: result.addedIds, count: result.added });
      }
      setResizePreview(null);
      await loadAreaLocations(selectedAreaId);
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
    // Snapshot the pre-edit value of every field about to change, so the
    // save can be undone by replaying these back through updateLocation.
    const previous: LocationEdits = {};
    for (const key of Object.keys(edits) as Array<keyof LocationEdits>) {
      (previous as Record<string, unknown>)[key] = loc[key as keyof Location];
    }
    setSavingLocationId(loc.id);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.updateLocation({ id: loc.id, ...edits });
      setAreaLocations((prev) => prev.map((l) => (l.id === loc.id ? updated : l)));
      setLocationEdits((prev) => {
        const next = { ...prev };
        delete next[loc.id];
        return next;
      });
      setSuccess(`Saved ${updated.fullLocationCode}.`);
      setUndoAction({ kind: "location-updated", id: loc.id, code: updated.fullLocationCode, previous });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save location");
    } finally {
      setSavingLocationId(null);
    }
  }

  async function handleUndo() {
    if (!undoAction) return;
    setUndoing(true);
    setError(null);
    try {
      switch (undoAction.kind) {
        case "location-created": {
          const result = await api.deleteLocations([undoAction.id]);
          if (result.deleted === 0) {
            setError(`Could not undo -- ${undoAction.code} already has a pallet in it.`);
            break;
          }
          setSuccess(`Removed ${undoAction.code}.`);
          setUndoAction(null);
          if (selectedAreaId) await loadAreaLocations(selectedAreaId);
          break;
        }
        case "resize-added": {
          const result = await api.deleteLocations(undoAction.ids);
          setSuccess(
            result.skipped > 0
              ? `Removed ${result.deleted} location(s). ${result.skipped} already had a pallet and were kept.`
              : `Removed ${result.deleted} location(s).`,
          );
          setUndoAction(null);
          if (selectedAreaId) await loadAreaLocations(selectedAreaId);
          break;
        }
        case "area-created": {
          await api.deleteArea(undoAction.id);
          setSuccess(`Removed area "${undoAction.name}".`);
          setUndoAction(null);
          await loadAreas();
          break;
        }
        case "area-updated": {
          const area = await api.updateArea({ id: undoAction.id, ...undoAction.previous });
          setSuccess(`Reverted area "${area.name}".`);
          setUndoAction(null);
          await loadAreas();
          if (selectedAreaId === undoAction.id) selectArea(area);
          break;
        }
        case "location-updated": {
          const updated = await api.updateLocation({ id: undoAction.id, ...undoAction.previous });
          setAreaLocations((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
          setSuccess(`Reverted ${undoAction.code}.`);
          setUndoAction(null);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not undo");
    } finally {
      setUndoing(false);
    }
  }

  const filteredLocations = useMemo(() => {
    const term = locationFilter.trim().toLowerCase();
    if (!term) return areaLocations;
    return areaLocations.filter((l) => l.fullLocationCode.toLowerCase().includes(term));
  }, [areaLocations, locationFilter]);

  const areaPicker = (
    <label>
      Area
      <select
        value={selectedAreaId}
        onChange={(event) => {
          const area = areas.find((a) => a.id === event.target.value);
          if (area) selectArea(area);
        }}
      >
        {areas.map((area) => (
          <option key={area.id} value={area.id}>
            {area.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section>
      <PageHeader eyebrow="Warehouse Setup" title="Manage Storage Locations" />

      {loading && <LoadingBlock />}
      {loadError && <ErrorBlock message={loadError} />}

      {!loading && !loadError && (
        <>
          <div className="button-row" role="tablist" aria-label="Warehouse setup sections">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`pill${activeTab === tab.key ? " active" : ""}`}
                onClick={() => {
                  setActiveTab(tab.key);
                  setError(null);
                  setSuccess(null);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error && <ErrorBlock message={error} />}
          {success && (
            <div className="state-block success" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span>{success}</span>
              {undoAction && (
                <button type="button" className="secondary-button" disabled={undoing} onClick={handleUndo}>
                  {undoing ? "Undoing..." : "Undo"}
                </button>
              )}
            </div>
          )}

          {activeTab === "add-location" && (
            <form className="panel form-panel" onSubmit={handleCreateLocation}>
              <h2>Add a location</h2>
              <p className="subtle">
                Permanent locations are reserved, standing storage. Temporary locations are marked
                overflow-capable so they only get used when a SKU's permanent slots are full.
              </p>

              <div className="form-grid">
                {areaPicker}

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

                {areaZones.length !== 1 && (
                  <label>
                    Code prefix
                    <input
                      value={manualZone}
                      onChange={(event) => setManualZone(event.target.value)}
                      placeholder={selectedArea ? selectedArea.name.slice(0, 3).toUpperCase() : "e.g. SUP"}
                    />
                  </label>
                )}
              </div>

              {areaZones.length === 1 && (
                <p className="subtle">
                  This location's code will start with <strong>{areaZones[0]}</strong>, matching the rest
                  of {selectedArea?.name ?? "this area"}.
                </p>
              )}

              <div className="button-row">
                <button type="submit" disabled={submitting || !selectedAreaId || !newLocationZone}>
                  <MapPin size={18} aria-hidden="true" />
                  {submitting ? "Adding..." : "Add location"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "add-area" && (
            <form className="panel form-panel" onSubmit={handleCreateArea}>
              <h2>Add a new area</h2>
              <p className="subtle">
                Create a whole new named storage area (like "Superior" or "Whitefish") before adding
                locations to it.
              </p>
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
                <button type="submit" disabled={submitting || !newAreaName.trim()}>
                  {submitting ? "Adding..." : "Add area"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "edit-area" && (
            <div className="panel form-panel">
              <h2>Edit an area</h2>
              <p className="subtle">
                Change an area's name, type, or flags, and fix up individual locations below — depth,
                overflow/flex capability, shortened-height, or status.
              </p>

              <form onSubmit={handleSaveArea}>
                <div className="form-grid">
                  {areaPicker}

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
                  <button type="submit" disabled={savingArea || !selectedAreaId}>
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

              {loadingAreaLocations && <LoadingBlock />}

              {!loadingAreaLocations && areaLocations.length > 0 && (
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
                                  {locationStatusLabel(status)}
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

              {!loadingAreaLocations && areaLocations.length === 0 && (
                <p className="subtle" style={{ marginTop: 12 }}>
                  No locations in this area yet.
                </p>
              )}
            </div>
          )}

          {activeTab === "resize" && (
            <div className="panel form-panel">
              <h2>Resize a permanent-location grid</h2>
              <p className="subtle">
                Add or remove every location in a block of aisles &times; bays &times; levels &times; depth
                positions for {selectedArea?.name ?? "the selected area"}. Each range below is inclusive on
                both ends (e.g. aisle 1 to 3 covers aisles 1, 2, and 3) &mdash; set start and end to the same
                number to target just one. Only permanent (non-overflow) locations are affected, and
                nothing occupied is ever removed.
              </p>

              <div className="form-grid">
                {areaPicker}

                {permanentZones.length !== 1 && (
                  <label>
                    Code prefix
                    <input
                      value={manualZone}
                      onChange={(event) => setManualZone(event.target.value)}
                      placeholder={selectedArea ? selectedArea.name.slice(0, 3).toUpperCase() : "e.g. SUP"}
                    />
                  </label>
                )}

                <label>
                  Level range
                  <div className="button-row" style={{ marginTop: 0 }}>
                    <input
                      type="number"
                      min="1"
                      value={resizeLevelStart}
                      onChange={(event) => setResizeLevelStart(Math.max(1, Number(event.target.value) || 1))}
                    />
                    <span className="subtle" style={{ alignSelf: "center" }}>to</span>
                    <input
                      type="number"
                      min="1"
                      value={resizeLevelEnd}
                      onChange={(event) => setResizeLevelEnd(Math.max(1, Number(event.target.value) || 1))}
                    />
                  </div>
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

              {permanentZones.length === 1 && (
                <p className="subtle">
                  Using code prefix <strong>{permanentZones[0]}</strong>, matching this area's other
                  permanent locations.
                </p>
              )}

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

              {!resizePreview && !resizeZone && (
                <p className="subtle">Enter a code prefix above, then click Preview.</p>
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
          )}
        </>
      )}
    </section>
  );
}
