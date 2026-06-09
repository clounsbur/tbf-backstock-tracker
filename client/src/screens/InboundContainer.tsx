import { FormEvent, useEffect, useMemo, useState } from "react";
import { PackagePlus } from "lucide-react";
import { api, type Location, type PutawaySkuPlan } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ErrorBlock } from "../components/StateBlocks";

type ManifestRow = { code: string; qty: number };

function slotLabel(loc: Location | null): string {
  return loc ? loc.fullLocationCode : "No slot — assign manually";
}

export function InboundContainer() {
  const [manifest, setManifest] = useState<ManifestRow[]>([{ code: "", qty: 4 }]);
  const [catalog, setCatalog] = useState<{ code: string; desc: string }[]>([]);
  const [plan, setPlan] = useState<PutawaySkuPlan[] | null>(null);
  // overrides: key `${skuIndex}:${palletIndex}` -> chosen Location
  const [overrides, setOverrides] = useState<Record<string, Location>>({});
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<"manifest" | "plan">("manifest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await (await import("../api/client")).supabase
          .from("products")
          .select("item_code,description")
          .eq("is_pickable", true)
          .order("item_code");
        setCatalog((data ?? []).map((p: any) => ({ code: p.item_code, desc: p.description ?? "" })));
      } catch {
        /* autocomplete is optional */
      }
    })();
  }, []);

  function setRow(i: number, patch: Partial<ManifestRow>) {
    setManifest((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setManifest((rows) => [...rows, { code: "", qty: 4 }]);
  }
  function removeRow(i: number) {
    setManifest((rows) => {
      const next = rows.filter((_, idx) => idx !== i);
      return next.length ? next : [{ code: "", qty: 4 }];
    });
  }

  const manifestValid = manifest.filter((r) => r.code.trim() && r.qty > 0);
  const manifestPallets = manifestValid.reduce((n, r) => n + r.qty, 0);

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!manifestValid.length) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.planContainerPutaway(
        manifestValid.map((r) => ({ itemCode: r.code.trim(), qty: r.qty })),
      );
      setPlan(result);
      setOverrides({});
      setApproved({});
      setPhase("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate putaway plan");
    } finally {
      setBusy(false);
    }
  }

  function chosenLoc(skuIdx: number, a: { palletIndex: number; location: Location | null }): Location | null {
    return overrides[`${skuIdx}:${a.palletIndex}`] ?? a.location;
  }
  // a pallet needs approval if its CURRENT chosen slot is shortened-height and not yet approved.
  // An explicit override to a normal slot clears the requirement; override to a short slot re-requires it.
  function pendingApproval(skuIdx: number, a: { palletIndex: number; location: Location | null; needsApproval: boolean }): boolean {
    const key = `${skuIdx}:${a.palletIndex}`;
    const loc = chosenLoc(skuIdx, a);
    const isShort = loc ? Boolean(loc.isShortenedHeight) : a.needsApproval;
    return isShort && !approved[key];
  }

  const planStats = useMemo(() => {
    if (!plan) return { pallets: 0, placed: 0, manual: 0 };
    let pallets = 0;
    let placed = 0;
    let pending = 0;
    plan.forEach((sku, si) =>
      sku.assignments.forEach((a) => {
        pallets += 1;
        const loc = chosenLoc(si, a);
        if (loc && !pendingApproval(si, a)) placed += 1;
        else if (loc && pendingApproval(si, a)) pending += 1;
      }),
    );
    return { pallets, placed, pending, manual: pallets - placed - pending };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, overrides, approved]);

  async function confirm() {
    if (!plan) return;
    const placements: { itemCode: string; locationId: string }[] = [];
    plan.forEach((sku, si) =>
      sku.assignments.forEach((a) => {
        const loc = chosenLoc(si, a);
        if (loc && !pendingApproval(si, a)) placements.push({ itemCode: sku.itemCode, locationId: loc.id });
      }),
    );
    if (!placements.length) return;
    setBusy(true);
    setError(null);
    try {
      const { placed } = await api.commitPutaway(placements);
      setDone(`Placed ${placed} pallets. Logged as INBOUND_PUTAWAY.`);
      setPlan(null);
      setManifest([{ code: "", qty: 4 }]);
      setPhase("manifest");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm putaway");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <PageHeader eyebrow="Receiving" title="Incoming container" />

      {error && <ErrorBlock message={error} />}
      {done && <div className="state-block success">{done}</div>}

      {phase === "manifest" && (
        <form onSubmit={generate}>
          <p className="subtle" style={{ marginBottom: 12 }}>
            Enter each SKU on the container and how many pallets arrived. A putaway list is generated from the routing rules.
          </p>
          <div className="inbound-table">
            <div className="inbound-head">
              <span>SKU</span>
              <span>Pallets</span>
              <span />
            </div>
            {manifest.map((row, i) => (
              <div className="inbound-row" key={i}>
                <input
                  list="catalog"
                  value={row.code}
                  onChange={(e) => setRow(i, { code: e.target.value.trim() })}
                  placeholder="Scan or type item code"
                />
                <div className="qty-stepper">
                  <button
                    type="button"
                    aria-label="Decrease pallets"
                    onClick={() => setRow(i, { qty: Math.max(1, row.qty - 1) })}
                    disabled={row.qty <= 1}
                  >
                    −
                  </button>
                  <span className="qty-value">{row.qty}</span>
                  <button
                    type="button"
                    aria-label="Increase pallets"
                    onClick={() => setRow(i, { qty: row.qty + 1 })}
                  >
                    +
                  </button>
                </div>
                <button type="button" className="inbound-rm" aria-label="Remove row" onClick={() => removeRow(i)}>
                  ×
                </button>
              </div>
            ))}
            <datalist id="catalog">
              {catalog.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.desc}
                </option>
              ))}
            </datalist>
          </div>
          <div className="button-row" style={{ marginTop: 12 }}>
            <button type="button" className="secondary-button" onClick={addRow}>
              + Add SKU
            </button>
            <span className="subtle" style={{ alignSelf: "center" }}>
              {manifestValid.length
                ? `${manifestValid.length} SKUs · ${manifestPallets} pallets`
                : ""}
            </span>
            <button type="submit" disabled={busy || !manifestValid.length} style={{ marginLeft: "auto" }}>
              <PackagePlus size={18} aria-hidden="true" />
              {busy ? "Generating..." : "Generate putaway list"}
            </button>
          </div>
        </form>
      )}

      {phase === "plan" && plan && (
        <div>
          <div className="inbound-plan-summary">
            <span>
              <strong>{planStats.pallets}</strong> pallets · {planStats.placed} placed
              {planStats.pending > 0 && <span className="inbound-manual"> · {planStats.pending} need approval (short slot)</span>}
              {planStats.manual > 0 && <span className="inbound-manual"> · {planStats.manual} need a slot</span>}
            </span>
          </div>

          {plan.map((sku, si) => (
            <div className="panel inbound-sku" key={sku.itemCode + si}>
              <div className="panel-heading">
                <div>
                  <h2>
                    {sku.itemCode} <span className="subtle" style={{ display: "inline" }}>{sku.description}</span>
                  </h2>
                  <p>
                    {sku.family ?? "unrouted"} · {sku.qty} pallets
                  </p>
                </div>
              </div>
              {sku.assignments.map((a) => {
                const loc = chosenLoc(si, a);
                return (
                  <div className="inbound-pallet" key={a.palletIndex}>
                    <span className="inbound-pallet-tag">
                      Pallet {a.palletIndex}/{a.palletOf}
                    </span>
                    <div className="inbound-slots">
                      {loc && (
                        <span
                          className={`inbound-slot chosen${pendingApproval(si, a) ? " short" : ""}`}
                          title={slotLabel(loc)}
                        >
                          {loc.fullLocationCode}
                          {loc.isShortenedHeight && " ↧"}
                        </span>
                      )}
                      {loc && pendingApproval(si, a) && (
                        <button
                          type="button"
                          className="inbound-approve"
                          onClick={() => setApproved((p) => ({ ...p, [`${si}:${a.palletIndex}`]: true }))}
                        >
                          Short slot — approve
                        </button>
                      )}
                      {!loc && <span className="inbound-slot none">No slot — pick one</span>}
                      {a.options
                        .filter((o) => o.id !== loc?.id)
                        .slice(0, 4)
                        .map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            className="inbound-slot alt"
                            onClick={() =>
                              setOverrides((prev) => ({ ...prev, [`${si}:${a.palletIndex}`]: o }))
                            }
                          >
                            {o.fullLocationCode}
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <div className="button-row" style={{ marginTop: 16 }}>
            <button type="button" className="secondary-button" onClick={() => setPhase("manifest")}>
              Edit contents
            </button>
            <button type="button" onClick={confirm} disabled={busy || planStats.placed === 0} style={{ marginLeft: "auto" }}>
              {busy ? "Placing..." : `Confirm putaway (${planStats.placed})`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
