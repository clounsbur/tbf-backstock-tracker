import { FormEvent, useEffect, useMemo, useState } from "react";
import { MoveRight, RefreshCw } from "lucide-react";
import { api, type MoveDestination, type MoveTransaction, type Pallet } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { RecentMoves } from "../components/RecentMoves";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { StatusBadge, formatLabel } from "../components/StatusBadge";

export function MovePallet() {
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [destinations, setDestinations] = useState<MoveDestination[]>([]);
  const [destinationSummary, setDestinationSummary] = useState<Record<string, number> | null>(null);
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
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [moveRefreshKey, setMoveRefreshKey] = useState(0);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const palletResponse = await api.listPallets();
      setPallets(palletResponse.pallets);
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

  useEffect(() => {
    async function loadDestinations() {
      if (!selectedPalletId) {
        setDestinations([]);
        setDestinationSummary(null);
        setDestinationError(null);
        return;
      }

      try {
        const response = await api.getMoveDestinations(selectedPalletId);
        setDestinations(response.destinations);
        setDestinationSummary(response.summary);
        setDestinationError(null);
      } catch (loadError) {
        setDestinations([]);
        setDestinationSummary(null);
        setDestinationError(loadError instanceof Error ? loadError.message : "Could not load destination guidance");
      }
    }

    void loadDestinations();
  }, [selectedPalletId]);

  const candidateLocations = useMemo(
    () => destinations,
    [destinations],
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
      setDestinations([]);
      setDestinationSummary(null);
      setNotes("");
      await loadData();
      setMoveRefreshKey((current) => current + 1);
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

          <div className="destination-picker">
            <div className="panel-heading">
              <div>
                <h2>Destination</h2>
                <p>Categories and reasons come from the backend move-destination rules.</p>
              </div>
            </div>
            {destinationSummary && (
              <div className="destination-summary-row">
                {Object.entries(destinationSummary).map(([category, count]) => (
                  <span className={`decision-pill ${category}`} key={category}>
                    {formatLabel(category)}: {count}
                  </span>
                ))}
              </div>
            )}
            {destinationError && <div className="state-block warning">{destinationError}</div>}
            {!selectedPalletId && <p className="subtle">Select a pallet to load authoritative destination guidance.</p>}
            <div className="destination-list">
              {candidateLocations.map(({ location, category, reasons }) => (
                <button
                  className={`destination-row ${category}${selectedLocationId === location.id ? " selected" : ""}`}
                  key={location.id}
                  type="button"
                  onClick={() => setSelectedLocationId(location.id)}
                >
                  <span className="destination-main">
                    <strong>{location.fullLocationCode}</strong>
                    <small>{reasons[0]}</small>
                  </span>
                  <span className="destination-meta">
                    <span className={`decision-pill ${category}`}>{formatLabel(category)}</span>
                    <StatusBadge value={location.status} />
                    {location.currentPallet && <span className="mini-text">{location.currentPallet.palletLicensePlate}</span>}
                  </span>
                </button>
              ))}
            </div>
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
                <DestinationSummary
                  destination={candidateLocations.find(({ location }) => location.id === selectedLocationId)}
                />
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

      <RecentMoves refreshKey={moveRefreshKey} />
    </section>
  );
}

function DestinationSummary({ destination }: { destination?: MoveDestination }) {
  if (!destination) return null;

  const { location, category, reasons } = destination;

  return (
    <div className="destination-summary">
      <p>
        <strong>{location.fullLocationCode}</strong>
      </p>
      <span className={`decision-pill ${category}`}>{formatLabel(category)}</span>
      <ul className="reason-list compact-reasons">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
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
