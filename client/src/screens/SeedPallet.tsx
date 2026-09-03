import { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { PackagePlus, X } from "lucide-react";
import { api, type Location, type LocationStatus, type Sku, type WarehouseArea } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { LocationPicker } from "../components/LocationPicker";

type StoredEntry = {
  at: string;
  itemCode: string;
  description: string;
  locationCode: string;
  quantity: number;
  palletLicensePlate: string;
  lotNumber: string;
};

// Everything needed to undo one pallet just stored -- the location's status
// before it was occupied, so undo can put it back exactly as it was rather
// than just assuming "OPEN".
type UndoStoreItem = { palletId: string; locationId: string; locationCode: string; previousStatus: LocationStatus };

const LAST_LOT_STORAGE_KEY = "seedPallet.lastLotNumber";

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function readLastLotNumber(): string {
  try {
    return localStorage.getItem(LAST_LOT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function SeedPallet() {
  const [codeInput, setCodeInput] = useState("");
  const [product, setProduct] = useState<Sku | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [lookingUpProduct, setLookingUpProduct] = useState(false);

  const [locationInput, setLocationInput] = useState("");
  // Multiple locations can be queued for the same SKU/lot/quantity -- one
  // pallet gets created per selected location when storing. Clicking a
  // queued location's chip expands a small editor for that one location's
  // quantity/lot, overriding the shared defaults below just for it.
  const [selectedLocations, setSelectedLocations] = useState<Location[]>([]);
  const [locationOverrides, setLocationOverrides] = useState<Record<string, { quantity?: number; lotNumber?: string }>>({});
  const [expandedChipId, setExpandedChipId] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lookingUpLocation, setLookingUpLocation] = useState(false);

  const [areas, setAreas] = useState<WarehouseArea[]>([]);
  const [pickerAreaId, setPickerAreaId] = useState("");
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [loadingPicker, setLoadingPicker] = useState(true);

  const [quantity, setQuantity] = useState(1);
  const [palletLicensePlate, setPalletLicensePlate] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [lastLotNumber, setLastLotNumber] = useState(readLastLotNumber);

  const [storing, setStoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<StoredEntry[]>([]);
  const [storeSuccess, setStoreSuccess] = useState<string | null>(null);
  const [undoItems, setUndoItems] = useState<UndoStoreItem[] | null>(null);
  const [undoing, setUndoing] = useState(false);

  // Scan-style fields default to inputMode="none" so tapping them to focus
  // for a scanner doesn't pop the on-screen keyboard; a double-tap switches
  // to the real inputMode and re-focuses to bring the keyboard up on demand.
  const [codeKeyboardOn, setCodeKeyboardOn] = useState(false);
  const [locationKeyboardOn, setLocationKeyboardOn] = useState(false);
  const [lotKeyboardOn, setLotKeyboardOn] = useState(false);

  const codeInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const lotInputRef = useRef<HTMLInputElement>(null);

  const lotSuggestion = lastLotNumber || currentYearMonth();
  const selectedIds = useMemo(() => new Set(selectedLocations.map((l) => l.id)), [selectedLocations]);

  function wakeKeyboard(ref: RefObject<HTMLInputElement>, setOn: (on: boolean) => void) {
    setOn(true);
    const el = ref.current;
    if (!el) return;
    el.blur();
    setTimeout(() => el.focus(), 30);
  }

  async function loadPickerData() {
    setLoadingPicker(true);
    try {
      const [areasResp, locationsResp] = await Promise.all([api.listAreas(), api.listLocations()]);
      setAreas(areasResp.areas);
      setAllLocations(locationsResp.locations);
      setPickerAreaId((current) => current || areasResp.areas[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load locations");
    } finally {
      setLoadingPicker(false);
    }
  }

  useEffect(() => {
    codeInputRef.current?.focus();
    void loadPickerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickerLocations = useMemo(
    () => allLocations.filter((l) => l.areaId === pickerAreaId),
    [allLocations, pickerAreaId],
  );

  async function handleLookupProduct(event: FormEvent) {
    event.preventDefault();
    if (!codeInput.trim()) return;
    setLookingUpProduct(true);
    setProductError(null);
    setProduct(null);
    try {
      const found = await api.lookupProductByCode(codeInput.trim());
      if (!found) {
        setProductError(`No SKU matches "${codeInput.trim()}".`);
        return;
      }
      setProduct(found);
      if (found.palletsPerFullAllocation) setQuantity(found.palletsPerFullAllocation);
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookingUpProduct(false);
    }
  }

  function toggleLocation(loc: Location) {
    setSelectedLocations((prev) =>
      prev.some((l) => l.id === loc.id) ? prev.filter((l) => l.id !== loc.id) : [...prev, loc],
    );
    setLocationError(null);
    setLocationOverrides((prev) => {
      if (!(loc.id in prev)) return prev;
      const next = { ...prev };
      delete next[loc.id];
      return next;
    });
    setExpandedChipId((prev) => (prev === loc.id ? null : prev));
  }

  function setLocationOverride(id: string, patch: { quantity?: number; lotNumber?: string }) {
    setLocationOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function clearLocationOverride(id: string) {
    setLocationOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleLookupLocation(event: FormEvent) {
    event.preventDefault();
    if (!locationInput.trim()) return;
    setLookingUpLocation(true);
    setLocationError(null);
    try {
      const found = await api.lookupLocationByCode(locationInput.trim());
      if (!found) {
        setLocationError(`No location matches "${locationInput.trim()}".`);
        return;
      }
      if (found.status !== "OPEN" && found.status !== "OPEN_FLEX_SLOT" && found.status !== "RESERVED_HOME_SLOT") {
        setLocationError(`${found.fullLocationCode} is already occupied.`);
        return;
      }
      toggleLocation(found);
      setLocationInput("");
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookingUpLocation(false);
    }
  }

  function resetForNextScan() {
    setCodeInput("");
    setProduct(null);
    setProductError(null);
    setLocationInput("");
    setSelectedLocations([]);
    setLocationOverrides({});
    setExpandedChipId(null);
    setLocationError(null);
    setQuantity(1);
    setPalletLicensePlate("");
    setLotNumber("");
    setCodeKeyboardOn(false);
    setLocationKeyboardOn(false);
    setLotKeyboardOn(false);
    codeInputRef.current?.focus();
  }

  async function handleStore(event: FormEvent) {
    event.preventDefault();
    if (!product || selectedLocations.length === 0 || quantity <= 0) return;
    setStoring(true);
    setError(null);
    setStoreSuccess(null);
    setUndoItems(null);

    const stillSelected: Location[] = [];
    const successes: StoredEntry[] = [];
    const undoBatch: UndoStoreItem[] = [];
    const failures: string[] = [];
    const singleTarget = selectedLocations.length === 1;

    for (const loc of selectedLocations) {
      // A location's own quantity/lot overrides (set by expanding its chip)
      // win over the shared defaults above.
      const override = locationOverrides[loc.id];
      const effectiveQuantity = override?.quantity ?? quantity;
      const effectiveLotNumber = override?.lotNumber ?? lotNumber;
      try {
        const result = await api.seedPallet({
          productId: product.id,
          locationId: loc.id,
          quantity: effectiveQuantity,
          // A typed license plate identifies one physical pallet -- only honor
          // it when storing to exactly one location; each other pallet gets
          // its own auto-generated plate.
          palletLicensePlate: singleTarget ? palletLicensePlate.trim() || undefined : undefined,
          lotNumber: effectiveLotNumber.trim() || undefined,
        });
        successes.push({
          at: new Date().toLocaleTimeString(),
          itemCode: product.partNumber,
          description: product.description,
          locationCode: loc.fullLocationCode,
          quantity: effectiveQuantity,
          palletLicensePlate: result.palletLicensePlate,
          lotNumber: effectiveLotNumber.trim() || "—",
        });
        undoBatch.push({
          palletId: result.palletId,
          locationId: loc.id,
          locationCode: loc.fullLocationCode,
          previousStatus: loc.status,
        });
      } catch (err) {
        stillSelected.push(loc);
        failures.push(`${loc.fullLocationCode}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    if (successes.length) {
      setRecent((prev) => [...[...successes].reverse(), ...prev].slice(0, 25));
      setStoreSuccess(
        successes.length > 1
          ? `Stored ${successes.length} pallets of ${product.partNumber}.`
          : `Stored ${product.partNumber} to ${successes[0].locationCode}.`,
      );
      setUndoItems(undoBatch);
      if (lotNumber.trim()) {
        setLastLotNumber(lotNumber.trim());
        try {
          localStorage.setItem(LAST_LOT_STORAGE_KEY, lotNumber.trim());
        } catch {
          /* best-effort */
        }
      }
    }

    if (failures.length) {
      setError(`Stored ${successes.length} of ${selectedLocations.length}. Failed: ${failures.join("; ")}`);
      setSelectedLocations(stillSelected);
      await loadPickerData();
    } else {
      resetForNextScan();
      await loadPickerData();
    }
    setStoring(false);
  }

  async function handleUndoStore() {
    if (!undoItems || undoItems.length === 0) return;
    setUndoing(true);
    setError(null);
    try {
      const result = await api.undoSeedPallet(undoItems);
      if (result.undone === 0) {
        setError("Could not undo -- those pallets have already been moved or released elsewhere.");
      } else {
        setStoreSuccess(
          result.skipped > 0
            ? `Removed ${result.undone} pallet(s). ${result.skipped} had already been moved or released and were left alone.`
            : `Removed ${result.undone} pallet(s).`,
        );
      }
      setUndoItems(null);
      await loadPickerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not undo");
    } finally {
      setUndoing(false);
    }
  }

  const readyToStore = Boolean(product) && selectedLocations.length > 0 && quantity > 0;

  return (
    <section>
      <PageHeader eyebrow="Warehouse Setup" title="Scan & Store Pallet" />
      <p className="subtle" style={{ marginBottom: 12 }}>
        Scan a pallet's barcode or type its SKU, then pick one or more destination locations &mdash;
        tap open tiles below or scan/type codes directly to queue several at once. Confirm the
        quantity and lot number, then store &mdash; one pallet is created per selected location.
        Click a queued location's chip to give just that one a different quantity or lot. The
        form clears and refocuses on the barcode field after each store so you can keep going
        without touching the mouse.
      </p>

      {error && <ErrorBlock message={error} />}

      {storeSuccess && (
        <div className="state-block success" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>{storeSuccess}</span>
          {undoItems && undoItems.length > 0 && (
            <button type="button" className="secondary-button" disabled={undoing} onClick={handleUndoStore}>
              {undoing ? "Undoing..." : "Undo"}
            </button>
          )}
        </div>
      )}

      <div className="panel form-panel">
        <form className="search-bar" onSubmit={handleLookupProduct}>
          <label style={{ flex: 1 }}>
            Barcode or SKU
            <input
              ref={codeInputRef}
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value)}
              placeholder="Scan or type item code / barcode, then Enter"
              autoComplete="off"
              inputMode={codeKeyboardOn ? "text" : "none"}
              onDoubleClick={() => wakeKeyboard(codeInputRef, setCodeKeyboardOn)}
              title="Double-tap to bring up the keyboard"
            />
          </label>
          <button type="submit" disabled={lookingUpProduct || !codeInput.trim()} style={{ alignSelf: "flex-end" }}>
            {lookingUpProduct ? "Looking up..." : "Look up"}
          </button>
        </form>
        {productError && <ErrorBlock message={productError} />}
        {product && (
          <div className="state-block success">
            <strong>{product.partNumber}</strong> &mdash; {product.description}
          </div>
        )}
      </div>

      <div className="panel form-panel">
        <div className="form-grid">
          <label>
            Area
            <select value={pickerAreaId} onChange={(event) => setPickerAreaId(event.target.value)}>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name} ({area.areaType})
                </option>
              ))}
            </select>
          </label>

          <label>
            Or scan/type a location code
            <form className="search-bar" style={{ marginBottom: 0 }} onSubmit={handleLookupLocation}>
              <input
                ref={locationInputRef}
                value={locationInput}
                onChange={(event) => setLocationInput(event.target.value)}
                placeholder="Scan or type, then Enter"
                autoComplete="off"
                style={{ flex: 1 }}
                inputMode={locationKeyboardOn ? "text" : "none"}
                onDoubleClick={() => wakeKeyboard(locationInputRef, setLocationKeyboardOn)}
                title="Double-tap to bring up the keyboard"
              />
              <button type="submit" disabled={lookingUpLocation || !locationInput.trim()}>
                {lookingUpLocation ? "..." : "Add"}
              </button>
            </form>
          </label>
        </div>

        {locationError && <ErrorBlock message={locationError} />}

        {selectedLocations.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {selectedLocations.map((loc) => {
              const override = locationOverrides[loc.id];
              const hasOverride = override?.quantity != null || Boolean(override?.lotNumber);
              const expanded = expandedChipId === loc.id;
              return (
                <div key={loc.id} className="location-chip">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      className="pill active"
                      onClick={() => setExpandedChipId(expanded ? null : loc.id)}
                      title="Edit quantity/lot for this location"
                    >
                      {loc.fullLocationCode}
                      {hasOverride && <span className="chip-override-dot" title="Custom quantity or lot" aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={`Remove ${loc.fullLocationCode}`}
                      title="Remove"
                      onClick={() => toggleLocation(loc)}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                  {expanded && (
                    <div className="chip-editor">
                      <label>
                        Quantity
                        <input
                          type="number"
                          min="1"
                          value={override?.quantity ?? quantity}
                          onChange={(event) =>
                            setLocationOverride(loc.id, { quantity: Math.max(1, Number(event.target.value) || 1) })
                          }
                        />
                      </label>
                      <label>
                        Lot number
                        <input
                          value={override?.lotNumber ?? lotNumber}
                          onChange={(event) => setLocationOverride(loc.id, { lotNumber: event.target.value })}
                          placeholder={lotSuggestion}
                        />
                      </label>
                      {hasOverride && (
                        <button type="button" className="secondary-button" onClick={() => clearLocationOverride(loc.id)}>
                          Reset to default
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {loadingPicker && <LoadingBlock />}
        {!loadingPicker && (
          <div style={{ marginTop: 12 }}>
            <LocationPicker locations={pickerLocations} selectedIds={selectedIds} onToggle={toggleLocation} />
          </div>
        )}
      </div>

      <form className="panel form-panel" onSubmit={handleStore}>
        <div className="form-grid">
          <label>
            Quantity (per pallet)
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>

          <label>
            Pallet license plate (optional)
            <input
              value={palletLicensePlate}
              onChange={(event) => setPalletLicensePlate(event.target.value)}
              placeholder={
                selectedLocations.length > 1 ? "Auto-generated (multiple locations selected)" : "Auto-generated if left blank"
              }
              disabled={selectedLocations.length > 1}
            />
          </label>

          <label>
            Lot number (optional)
            <div className="button-row" style={{ marginTop: 0 }}>
              <input
                ref={lotInputRef}
                value={lotNumber}
                onChange={(event) => setLotNumber(event.target.value)}
                placeholder={lotSuggestion}
                inputMode={lotKeyboardOn ? "numeric" : "none"}
                onDoubleClick={() => wakeKeyboard(lotInputRef, setLotKeyboardOn)}
                title="Double-tap to bring up the keyboard"
                style={{ flex: 1 }}
              />
              <button type="button" className="secondary-button" onClick={() => setLotNumber(lotSuggestion)}>
                Use {lotSuggestion}
              </button>
            </div>
          </label>
        </div>

        <div className="button-row">
          <button type="submit" disabled={!readyToStore || storing}>
            <PackagePlus size={18} aria-hidden="true" />
            {storing
              ? "Storing..."
              : selectedLocations.length > 1
                ? `Store ${selectedLocations.length} pallets`
                : "Store pallet"}
          </button>
        </div>
      </form>

      {recent.length > 0 && (
        <div className="panel">
          <h2>Stored this session</h2>
          <div className="table-wrap tall">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>SKU</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Qty</th>
                  <th>Pallet</th>
                  <th>Lot</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((entry, i) => (
                  <tr key={i}>
                    <td>{entry.at}</td>
                    <td>{entry.itemCode}</td>
                    <td>{entry.description}</td>
                    <td>{entry.locationCode}</td>
                    <td>{entry.quantity}</td>
                    <td>{entry.palletLicensePlate}</td>
                    <td>{entry.lotNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
