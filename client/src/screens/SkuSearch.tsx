import { FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { api, type Sku } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { StatusBadge } from "../components/StatusBadge";

export function SkuSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Sku[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const response = await api.searchSkus(query.trim());
      setResults(response.skus);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <PageHeader eyebrow="SKU Search" title="Find Pallet Locations" />

      <form className="search-bar" onSubmit={handleSubmit}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search SKU, part number, description, or family"
        />
        <button type="submit">
          <Search size={18} aria-hidden="true" />
          Search
        </button>
      </form>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && hasSearched && results.length === 0 && <EmptyBlock message="No SKUs found." />}

      <div className="stack">
        {results.map((sku) => (
          <article className="panel" key={sku.id}>
            <div className="panel-heading">
              <div>
                <h2>{sku.partNumber}</h2>
                <p>{sku.description}</p>
              </div>
              <StatusBadge value={sku.velocityClass} />
            </div>

            <div className="split-grid">
              <div>
                <h3>Home Locations</h3>
                {sku.homeLocations?.length ? (
                  <ul className="compact-list">
                    {sku.homeLocations.map((location) => (
                      <li key={location.id}>
                        <strong>{location.fullLocationCode}</strong>
                        <span>{location.area?.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="subtle">No home slots assigned.</p>
                )}
              </div>

              <div>
                <h3>Current Pallets</h3>
                {sku.pallets?.length ? (
                  <div className="table-wrap compact">
                    <table>
                      <thead>
                        <tr>
                          <th>Pallet</th>
                          <th>Qty</th>
                          <th>Location</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sku.pallets.map((pallet) => (
                          <tr key={pallet.id}>
                            <td>{pallet.palletLicensePlate}</td>
                            <td>{pallet.quantity}</td>
                            <td>{pallet.currentLocation?.fullLocationCode ?? "Unplaced"}</td>
                            <td>{pallet.currentLocation?.status ? <StatusBadge value={pallet.currentLocation.status} /> : pallet.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="subtle">No pallets found for this SKU.</p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
