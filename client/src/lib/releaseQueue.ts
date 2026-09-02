// A tiny localStorage-backed handoff so Floor Map's SKU search can queue a
// pallet for Release to Picking without the two screens sharing any React
// state. Release to Picking drains this queue into its own list on mount.
const STORAGE_KEY = "releaseQueue";

export type QueuedRelease = {
  palletId: string;
  position: string;
  sku: string;
  desc: string;
  location: string;
};

export function readReleaseQueue(): QueuedRelease[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedRelease[]) : [];
  } catch {
    return [];
  }
}

export function addToReleaseQueue(entry: QueuedRelease): void {
  try {
    const queue = readReleaseQueue().filter((q) => q.palletId !== entry.palletId);
    queue.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* best-effort */
  }
}

export function clearReleaseQueue(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}
