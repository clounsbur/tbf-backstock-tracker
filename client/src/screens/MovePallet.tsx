import { FormEvent, useEffect, useMemo, useState } from "react";
import { MoveRight, RefreshCw } from "lucide-react";
import { api, type Location, type MoveTransaction, type Pallet } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { RecentMoves } from "../components/RecentMoves";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { StatusBadge, formatLabel } from "../components/StatusBadge";

type DestinationCategory = "recommended" | "allowed" | "occupied" | "likely-invalid";

type ClassifiedLocation = {
  location: Location;
  category: DestinationCategory;
  reason: string;
};

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
  const [recommendedLocationIds, setRecommendedLocationIds] = useState<Set<string>>(new Set());
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [moveRefreshKey, setMoveRefreshKey] = useState(0);

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

  useEffect(() => {
    async function loadRecommendations() {
      if (!selectedPallet?.skuId) {
        setRecommendedLocationIds(new Set());
        setRecommendationError(null);
        return;
      }

      try {
        const response = await api.getInboundSuggestions({ skuId: selectedPallet.skuId, palletQty: 1 });
        setRecommendedLocationIds(new Set(response.suggestions.map((suggestion) => suggestion.location.id)));
        setRecommendationError(null);
      } catch (loadError) {
        setRecommendedLocationIds(new Set());
        setRecommendationError(loadError instanceof Error ? loadError.message : "Could not load recommended destinations");
      }
    }

    void loadRecommendations();
  }, [selectedPallet?.skuId]);

  const candidateLocations = useMemo(
    () =>
      locations
        .map((location) => classifyDestination(location, selectedPallet, recommendedLocationIds))
        .sort((a, b) => {
          const categoryOrder: Record<DestinationCategory, number> = {
            recommended: 0,
            allowed: 1,
            occupied: 2,
            "likely-invalid": 3,
          };

          return (
            categoryOrder[a.category] - categoryOrder[b.category] ||
            (a.location.travelSequence ?? 9999) - (b.location.travelSequence ?? 9999) ||
            a.location.fullLocationCode.localeCompare(b.location.fullLocationCode)
          );
        }),
    [locations, recommendedLocationIds, selectedPallet],
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
                <p>Backend validation still makes the final decision when you submit.</p>
              </div>
            </div>
            {recommendationError && <div className="state-block warning">{recommendationError}</div>}
            <div className="destination-list">
              {candidateLocations.map(({ location, category, reason }) => (
                <button
                  className={`destination-row ${category}${selectedLocationId === location.id ? " selected" : ""}`}
                  key={location.id}
                  type="button"
                  onClick={() => setSelectedLocationId(location.id)}
                >
                  <span className="destination-main">
                    <strong>{location.fullLocationCode}</strong>
                    <small>{reason}</small>
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
                  classifiedLocation={candidateLocations.find(({ location }) => location.id === selectedLocationId)}
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

function DestinationSummary({ classifiedLocation }: { classifiedLocation?: ClassifiedLocation }) {
  if (!classifiedLocation) return null;

  const { location, category, reason } = classifiedLocation;

  return (
    <div className="destination-summary">
      <p>
        <strong>{location.fullLocationCode}</strong>
      </p>
      <span className={`decision-pill ${category}`}>{formatLabel(category)}</span>
      <span className="subtle">{reason}</span>
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

function classifyDestination(location: Location, selectedPallet: Pallet | undefined, recommendedLocationIds: Set<string>): ClassifiedLocation {
  if (!selectedPallet?.sku) {
    return {
      location,
      category: location.currentPallet ? "occupied" : "allowed",
      reason: "Select a pallet to check SKU-specific rules.",
    };
  }

  if (location.id === selectedPallet.currentLocationId) {
    return {
      location,
      category: "likely-invalid",
      reason: "This is the pallet's current location.",
    };
  }

  if (location.status === "BLOCKED") {
    return {
      location,
      category: "likely-invalid",
      reason: "Location is blocked.",
    };
  }

  if (location.currentPallet) {
    return {
      location,
      category: "occupied",
      reason: `Occupied by ${location.currentPallet.palletLicensePlate}.`,
    };
  }

  if (location.isFrontHomeSlot && location.homeSkuId !== selectedPallet.skuId) {
    return {
      location,
      category: "likely-invalid",
      reason: "Front home slot belongs to another SKU.",
    };
  }

  const isBorrowedReserve = Boolean(location.homeSkuId && location.homeSkuId !== selectedPallet.skuId);

  if (isBorrowedReserve && (!location.isFlexSlot || !location.allowsOverflow)) {
    return {
      location,
      category: "likely-invalid",
      reason: "Borrowed reserve must be flex overflow-capable.",
    };
  }

  if (
    isBorrowedReserve &&
    location.partNumberStart &&
    location.partNumberEnd &&
    (selectedPallet.sku.partNumber < location.partNumberStart || selectedPallet.sku.partNumber > location.partNumberEnd)
  ) {
    return {
      location,
      category: "likely-invalid",
      reason: "Outside the part-number neighborhood.",
    };
  }

  if (recommendedLocationIds.has(location.id)) {
    return {
      location,
      category: "recommended",
      reason: "Returned by the live suggestion endpoint.",
    };
  }

  return {
    location,
    category: "allowed",
    reason: "Looks open under visible rules; backend will validate on submit.",
  };
}
