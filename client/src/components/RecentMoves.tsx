import { useEffect, useState } from "react";
import { api, type MoveTransaction } from "../api/client";
import { ErrorBlock, LoadingBlock } from "./StateBlocks";

export function RecentMoves({ refreshKey = 0 }: { refreshKey?: number }) {
  const [moves, setMoves] = useState<MoveTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMoves() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.listMoves(8);
        setMoves(response.moves);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load recent moves");
      } finally {
        setLoading(false);
      }
    }

    void loadMoves();
  }, [refreshKey]);

  return (
    <aside className="panel recent-moves">
      <div className="panel-heading">
        <div>
          <h2>Recent Moves</h2>
          <p>Latest saved movement activity</p>
        </div>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && moves.length === 0 && <p className="subtle">No moves have been logged yet.</p>}

      {!loading && !error && moves.length > 0 && (
        <ul className="move-list">
          {moves.map((move) => (
            <li key={move.id}>
              <strong>{move.pallet?.palletLicensePlate ?? "Unknown pallet"}</strong>
              <span>
                {move.fromLocation?.fullLocationCode ?? "Unplaced"} {" -> "} {move.toLocation?.fullLocationCode ?? "Unplaced"}
              </span>
              <small>
                {move.reasonCode} / {new Date(move.movedAt).toLocaleString()}
              </small>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
