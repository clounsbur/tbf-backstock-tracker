import { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { PackagePlus, X } from "lucide-react";
import { api, type Location, type Sku, type WarehouseArea } from "../api/client";
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
  // pallet gets created per selected location when storing.
  const [selectedLocations, setSelectedLocations] = useState<Location[]>([]);
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

    const stillSelected: Location[] = [];
    const successes: StoredEntry[] = [];
    const failures: string[] = [];
    const singleTarget = selectedLocations.length === 1;

    for (const loc of selectedLocations) {
      try {
        const result = await api.seedPallet({
          productId: product.id,
          locationId: loc.id,
          quantity,
          // A typed license plate identifies one physical pallet -- only honor
          // it when storing to exactly one location; each other pallet gets
          // its own auto-generated plate.
          palletLicensePlate: singleTarget ? palletLicensePlate.trim() || undefined : undefined,
          lotNumber: lotNumber.trim() || undefined,
        });
        successes.push({
          at: new Date().toLocaleTimeString(),
          itemCode: product.partNumber,
          description: product.description,
          locationCode: loc.fullLocationCode,
          quantity,
          palletLicensePlate: result.palletLicensePlate,
          lotNumber: lotNumber.trim() || "—",
        });
      } catch (err) {
        stillSelected.push(loc);
        failures.push(`${loc.fullLocationCode}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    if (successes.length) {
      setRecent((prev) => [...[...successes].reverse(), ...prev].slice(0, 25));
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

  const readyToStore = Boolean(product) && selectedLocations.length > 0 && quantity > 0;

  return (
    <section>
      <PageHeader eyebrow="Warehouse Setup" title="Scan & Store Pallet" />
      <p className="subtle" style={{ marginBottom: 12 }}>
        Scan a pallet's barcode or type its SKU, then pick one or more destination locations &mdash;
        tap open tiles below or scan/type codes directly to queue several at once. Confirm the
        quantity and lot number, then store &mdash; one pallet is created per selected location. The
        form clears and refocuses on the barcode field after each store so you can keep going
        without touching the mouse.
      </p>

      {error && <ErrorBlock message={error} />}

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
          <div className="button-row" style={{ marginTop: 8 }}>
            {selectedLocations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                className="pill active"
                onClick={() => toggleLocation(loc)}
                title="Remove"
              >
                {loc.fullLocationCode}
                <X size={12} aria-hidden="true" style={{ marginLeft: 4 }} />
              </button>
            ))}
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
