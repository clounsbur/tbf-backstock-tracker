import type { AreaType, LocationStatus } from "../api/client";

export function StatusBadge({ value }: { value: LocationStatus | AreaType | string }) {
  return <span className={`badge ${value.toLowerCase().replaceAll("_", "-")}`}>{formatLabel(value)}</span>;
}

export function formatLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Plain-language versions of the raw location status enum -- "Occupied Home
// Sku" is still jargon to someone who didn't help build this app.
const LOCATION_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  OCCUPIED_HOME_SKU: "Occupied",
  OCCUPIED_OVERFLOW_SKU: "Occupied (overflow)",
  RESERVED_HOME_SLOT: "Reserved, empty",
  OPEN_FLEX_SLOT: "Open (overflow-capable)",
  BLOCKED: "Blocked",
};

export function locationStatusLabel(status: string): string {
  return LOCATION_STATUS_LABELS[status] ?? formatLabel(status);
}
