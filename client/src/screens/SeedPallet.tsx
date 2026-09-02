import { FormEvent, useEffect, useRef, useState } from "react";
import { PackagePlus } from "lucide-react";
import { api, type Location, type Sku } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ErrorBlock } from "../components/StateBlocks";

type StoredEntry = {
  at: string;
  itemCode: string;
  description: string;
  locationCode: string;
  quantity: number;
  palletLicensePlate: string;
};

export function SeedPallet() {
  const [codeInput, setCodeInput] = useState("");
  const [product, setProduct] = useState<Sku | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [lookingUpProduct, setLookingUpProduct] = useState(false);

  const [locationInput, setLocationInput] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lookingUpLocation, setLookingUpLocation] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [palletLicensePlate, setPalletLicensePlate] = useState("");

  const [storing, setStoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<StoredEntry[]>([]);

  const codeInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    codeInputRef.current?.focus();
  }, []);

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
      locationInputRef.current?.focus();
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookingUpProduct(false);
    }
  }

  async function handleLookupLocation(event: FormEvent) {
    event.preventDefault();
    if (!locationInput.trim()) return;
    setLookingUpLocation(true);
    setLocationError(null);
    setLocation(null);
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
      setLocation(found);
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
    setLocation(null);
    setLocationError(null);
    setQuantity(1);
    setPalletLicensePlate("");
    codeInputRef.current?.focus();
  }

  async function handleStore(event: FormEvent) {
    event.preventDefault();
    if (!product || !location || quantity <= 0) return;
    setStoring(true);
    setError(null);
    try {
      const result = await api.seedPallet({
        productId: product.id,
        locationId: location.id,
        quantity,
        palletLicensePlate: palletLicensePlate.trim() || undefined,
      });
      setRecent((prev) => [
        {
          at: new Date().toLocaleTimeString(),
          itemCode: product.partNumber,
          description: product.description,
          locationCode: location.fullLocationCode,
          quantity,
          palletLicensePlate: result.palletLicensePlate,
        },
        ...prev,
      ].slice(0, 25));
      resetForNextScan();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not store pallet");
    } finally {
      setStoring(false);
    }
  }

  const readyToStore = Boolean(product && location) && quantity > 0;

  return (
    <section>
      <PageHeader eyebrow="Warehouse Setup" title="Scan & Store Pallet" />
      <p className="subtle" style={{ marginBottom: 12 }}>
        Scan a pallet's barcode or type its SKU, scan or type the destination location code, confirm
        the quantity, then store it. The form clears and refocuses after each pallet so you can keep
        scanning without touching the mouse.
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
        <form className="search-bar" onSubmit={handleLookupLocation}>
          <label style={{ flex: 1 }}>
            Location code
            <input
              ref={locationInputRef}
              value={locationInput}
              onChange={(event) => setLocationInput(event.target.value)}
              placeholder="Scan or type location code, then Enter"
              autoComplete="off"
            />
          </label>
          <button type="submit" disabled={lookingUpLocation || !locationInput.trim()} style={{ alignSelf: "flex-end" }}>
            {lookingUpLocation ? "Looking up..." : "Look up"}
          </button>
        </form>
        {locationError && <ErrorBlock message={locationError} />}
        {location && (
          <div className="state-block success">
            <strong>{location.fullLocationCode}</strong> &mdash; {location.area?.name ?? "unknown area"} &mdash; open
          </div>
        )}
      </div>

      <form className="panel form-panel" onSubmit={handleStore}>
        <div className="form-grid">
          <label>
            Quantity
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
              placeholder="Auto-generated if left blank"
            />
          </label>
        </div>

        <div className="button-row">
          <button type="submit" disabled={!readyToStore || storing}>
            <PackagePlus size={18} aria-hidden="true" />
            {storing ? "Storing..." : "Store pallet"}
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
