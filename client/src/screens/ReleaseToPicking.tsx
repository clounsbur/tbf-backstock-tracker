import { FormEvent, useState } from "react";
import { Search, PackageX } from "lucide-react";
import { api, type Pallet, type Sku } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ErrorBlock } from "../components/StateBlocks";

type ReleaseRow = {
  palletId: string;
  lp: string;
  sku: string;
  desc: string;
  location: string;
};

export function ReleaseToPicking() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ sku: Sku; pallets: Pallet[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<ReleaseRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    setError(null);
    setDone(null);
    try {
      const resp = await api.searchSkus(term);
      const sku =
        resp.skus.find((s) => s.partNumber.toLowerCase() === term.toLowerCase()) ?? resp.skus[0] ?? null;
      if (!sku) {
        setResults(null);
        setError(`No SKU found for "${term}".`);
        return;
      }
      const inBackstock = (sku.pallets ?? []).filter(
        (p) => p.status !== "CONSUMED" && p.currentLocation,
      );
      setResults({ sku, pallets: inBackstock });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  function addPallet(sku: Sku, p: Pallet) {
    if (list.some((r) => r.palletId === p.id)) return;
    setList((rows) => [
      ...rows,
      {
        palletId: p.id,
        lp: p.palletLicensePlate,
        sku: sku.partNumber,
        desc: sku.description,
        location: p.currentLocation?.fullLocationCode ?? "—",
      },
    ]);
  }
  function addAll(sku: Sku, pallets: Pallet[]) {
    pallets.forEach((p) => addPallet(sku, p));
  }
  function removeRow(palletId: string) {
    setList((rows) => rows.filter((r) => r.palletId !== palletId));
  }

  async function releaseAll() {
    if (!list.length) return;
    setBusy(true);
    setError(null);
    try {
      const { released } = await api.releaseToPicking(list.map((r) => r.palletId));
      setDone(`Released ${released} pallets to the picking floor. Logged as RELEASED_TO_PICKING.`);
      setList([]);
      setResults(null);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Release failed");
    } finally {
      setBusy(false);
    }
  }

  const inListIds = new Set(list.map((r) => r.palletId));

  return (
    <section>
      <PageHeader eyebrow="Picking floor" title="Release to picking" />

      {error && <ErrorBlock message={error} />}
      {done && <div className="state-block success">{done}</div>}

      <p className="subtle" style={{ marginBottom: 12 }}>
        Search or scan a SKU, add its backstock pallets to the release list, then release them all to the picking floor.
      </p>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Scan or type a SKU"
        />
        <button type="submit" disabled={searching}>
          <Search size={18} aria-hidden="true" />
          {searching ? "Searching..." : "Find pallets"}
        </button>
      </form>

      {results && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-heading">
            <div>
              <h2>
                {results.sku.partNumber} <span className="subtle" style={{ display: "inline" }}>{results.sku.description}</span>
              </h2>
              <p>{results.pallets.length} pallets in backstock</p>
            </div>
            {results.pallets.length > 0 && (
              <button type="button" className="secondary-button" onClick={() => addAll(results.sku, results.pallets)}>
                Add all
              </button>
            )}
          </div>
          {results.pallets.length === 0 ? (
            <p className="subtle">No backstock pallets for this SKU.</p>
          ) : (
            <div className="release-found">
              {results.pallets.map((p) => (
                <div className="release-found-row" key={p.id}>
                  <span>
                    <strong>{p.palletLicensePlate}</strong>
                    <span className="subtle" style={{ display: "inline", marginLeft: 8 }}>
                      {p.currentLocation?.fullLocationCode}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={inListIds.has(p.id)}
                    onClick={() => addPallet(results.sku, p)}
                  >
                    {inListIds.has(p.id) ? "Added" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Release list</h2>
            <p>{list.length} pallets queued</p>
          </div>
          {list.length > 0 && (
            <button type="button" onClick={releaseAll} disabled={busy}>
              <PackageX size={18} aria-hidden="true" />
              {busy ? "Releasing..." : `Release ${list.length} to picking`}
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <p className="subtle">Nothing queued yet. Find a SKU and add pallets.</p>
        ) : (
          <div className="release-list">
            {list.map((r) => (
              <div className="release-list-row" key={r.palletId}>
                <span>
                  <strong>{r.lp}</strong> · {r.sku} <span className="subtle" style={{ display: "inline" }}>{r.desc}</span>
                </span>
                <span className="release-loc">{r.location}</span>
                <button type="button" className="release-rm" aria-label="Remove" onClick={() => removeRow(r.palletId)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
