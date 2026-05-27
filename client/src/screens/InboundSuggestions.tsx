import { FormEvent, useState } from "react";
import { ClipboardList } from "lucide-react";
import { api, type InboundSuggestion, type Sku } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { StatusBadge } from "../components/StatusBadge";

export function InboundSuggestions() {
  const [partNumber, setPartNumber] = useState("100220");
  const [palletQty, setPalletQty] = useState(1);
  const [sku, setSku] = useState<Sku | null>(null);
  const [suggestions, setSuggestions] = useState<InboundSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!partNumber.trim()) return;

    setLoading(true);
    setHasRequested(true);
    setError(null);
    try {
      const response = await api.getInboundSuggestions({
        partNumber: partNumber.trim(),
        palletQty,
      });
      setSku(response.sku);
      setSuggestions(response.suggestions);
    } catch (suggestionError) {
      setSku(null);
      setSuggestions([]);
      setError(suggestionError instanceof Error ? suggestionError.message : "Could not load suggestions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <PageHeader eyebrow="Inbound Placement" title="Ranked Location Suggestions" />

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Part Number / SKU
            <input value={partNumber} onChange={(event) => setPartNumber(event.target.value)} />
          </label>
          <label>
            Pallet Quantity
            <input
              type="number"
              min="1"
              value={palletQty}
              onChange={(event) => setPalletQty(Number(event.target.value))}
            />
          </label>
        </div>
        <button type="submit">
          <ClipboardList size={18} aria-hidden="true" />
          Get Suggestions
        </button>
      </form>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && hasRequested && suggestions.length === 0 && <EmptyBlock message="No valid suggestions found." />}

      {sku && (
        <div className="result-header">
          <h2>{sku.partNumber}</h2>
          <p>{sku.description}</p>
          <StatusBadge value={sku.velocityClass} />
        </div>
      )}

      <div className="suggestion-list">
        {suggestions.map((suggestion, index) => (
          <article className="suggestion" key={suggestion.location.id}>
            <div className="rank">{index + 1}</div>
            <div className="suggestion-body">
              <div className="panel-heading">
                <div>
                  <h2>{suggestion.location.fullLocationCode}</h2>
                  <p>{suggestion.location.areaName}</p>
                </div>
                <div className="score">Score {suggestion.score}</div>
              </div>
              <StatusBadge value={suggestion.location.areaType} />
              <ul className="reason-list">
                {suggestion.reasons.map((reason) => (
                  <li key={reason.code}>{reason.label}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
