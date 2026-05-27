import type { AreaType, LocationStatus } from "../api/client";

export function StatusBadge({ value }: { value: LocationStatus | AreaType | string }) {
  return <span className={`badge ${value.toLowerCase().replaceAll("_", "-")}`}>{formatLabel(value)}</span>;
}

export function formatLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
