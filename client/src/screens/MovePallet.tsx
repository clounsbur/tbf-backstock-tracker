import { FormEvent, useEffect, useMemo, useState } from "react";
import { MoveRight, RefreshCw } from "lucide-react";
import { api, type Location, type MoveTransaction, type Pallet } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { StatusBadge } from "../components/StatusBadge";

export function MovePallet() {
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedPalletId, setSelectedPalletId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [movedBy, setMovedBy] = useState("warehouse.demo");
  const [reasonCode, setReasonCode] = useState("STANDARD_MOVE");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [latestMove, setLatestMove] = useState<MoveTransaction | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [palletResponse, locationResponse] = await Promise.all([api.listPallets(), api.listLocations()]);
      setPallets(palletResponse.pallets);
      setLocations(locationResponse.locations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load move data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedPallet = pallets.find((pallet) => pallet.id === selectedPalletId);

  const candidateLocations = useMemo(
    () =>
      locations
        .filter((location) => location.status !== "BLOCKED")
        .sort((a, b) => (a.travelSequence ?? 9999) - (b.travelSequence ?? 9999)),
    [locations],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedPalletId || !selectedLocationId) {
      setError("Select a pallet and destination.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setLatestMove(null);
    try {
      const response = await api.movePallet({
        palletId: selectedPalletId,
        toLocationId: selectedLocationId,
        movedBy,
        reasonCode,
        notes: notes.trim() || undefined,
      });
      setLatestMove(response.move);
      setSuccess(`Moved ${response.pallet.palletLicensePlate} to ${response.pallet.currentLocation?.fullLocationCode}.`);
      setSelectedPalletId("");
      setSelectedLocationId("");
      setNotes("");
      await loadData();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Move failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <PageHeader eyebrow="Move Workflow" title="Move A Pallet" />

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {success && <div className="state-block success">{success}</div>}

      {!loading && (
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Pallet
              <select value={selectedPalletId} onChange={(event) => setSelectedPalletId(event.target.value)}>
                <option value="">Select pallet</option>
                {pallets.map((pallet) => (
                  <option key={pallet.id} value={pallet.id}>
                    {pallet.palletLicensePlate} / {pallet.sku?.partNumber} / {pallet.currentLocation?.fullLocationCode ?? "Unplaced"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Destination
              <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)}>
                <option value="">Select destination</option>
                {candidateLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.fullLocationCode} / {location.status} {location.currentPallet ? "/ occupied" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Moved By
              <input value={movedBy} onChange={(event) => setMovedBy(event.target.value)} />
            </label>

            <label>
              Reason
              <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
                <option value="STANDARD_MOVE">Standard Move</option>
                <option value="INBOUND_PUTAWAY">Inbound Putaway</option>
                <option value="OVERFLOW_RELOCATION">Overflow Relocation</option>
                <option value="RECLAIM_HOME_SLOT">Reclaim Home Slot</option>
                <option value="CONSOLIDATION">Consolidation</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </select>
            </label>
          </div>

          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
          </label>

          <div className="move-summary">
            <div>
              <h3>Selected Pallet</h3>
              {selectedPallet ? (
                <p>
                  <strong>{selectedPallet.palletLicensePlate}</strong> / {selectedPallet.sku?.partNumber} /{" "}
                  {selectedPallet.currentLocation?.fullLocationCode ?? "Unplaced"}
                </p>
              ) : (
                <p className="subtle">No pallet selected.</p>
              )}
            </div>
            <div>
              <h3>Destination Rule State</h3>
              {selectedLocationId ? (
                <DestinationSummary location={locations.find((location) => location.id === selectedLocationId)} />
              ) : (
                <p className="subtle">No destination selected.</p>
              )}
            </div>
          </div>

          <div className="button-row">
            <button type="submit" disabled={submitting}>
              <MoveRight size={18} aria-hidden="true" />
              {submitting ? "Moving..." : "Move Pallet"}
            </button>
            <button className="secondary-button" type="button" onClick={() => void loadData()}>
              <RefreshCw size={18} aria-hidden="true" />
              Refresh Data
            </button>
          </div>
        </form>
      )}

      {latestMove && (
        <div className="panel">
          <h2>Latest Move</h2>
          <p>
            Move saved at {new Date(latestMove.movedAt).toLocaleString()} with reason {latestMove.reasonCode}.
          </p>
        </div>
      )}
    </section>
  );
}

function DestinationSummary({ location }: { location?: Location }) {
  if (!location) return null;

  return (
    <div className="destination-summary">
      <p>
        <strong>{location.fullLocationCode}</strong>
      </p>
      <StatusBadge value={location.status} />
      <div className="rule-tags">
        {location.isFrontHomeSlot && <span>Front home</span>}
        {location.isFlexSlot && <span>Flex</span>}
        {location.allowsOverflow && <span>Overflow OK</span>}
        {location.currentPallet && <span>Occupied</span>}
      </div>
    </div>
  );
}
