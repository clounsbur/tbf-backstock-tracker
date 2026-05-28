const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export type AreaType = "FRONT_HOME" | "BACKSTOCK" | "FLEX_RESERVE" | "OVERFLOW" | "RECEIVING";
export type LocationStatus =
  | "OPEN"
  | "OCCUPIED_HOME_SKU"
  | "OCCUPIED_OVERFLOW_SKU"
  | "RESERVED_HOME_SLOT"
  | "OPEN_FLEX_SLOT"
  | "BLOCKED";

export type WarehouseArea = {
  id: string;
  name: string;
  areaType: AreaType;
  sortOrder: number;
};

export type Sku = {
  id: string;
  partNumber: string;
  description: string;
  velocityClass: "FAST" | "MEDIUM" | "SLOW";
  productFamily: string | null;
  palletsPerFullAllocation: number;
  active: boolean;
  lotNumber: string | null;
  homeLocations?: Location[];
  pallets?: Pallet[];
};

export type Location = {
  id: string;
  areaId: string;
  zone: string;
  aisle: string;
  bay: string;
  level: string;
  depthPosition: number;
  fullLocationCode: string;
  homeSkuId: string | null;
  isFrontHomeSlot: boolean;
  isFlexSlot: boolean;
  allowsOverflow: boolean;
  status: LocationStatus;
  partNumberStart: string | null;
  partNumberEnd: string | null;
  travelSequence: number | null;
  area?: WarehouseArea;
  homeSku?: Sku | null;
  currentPallet?: Pallet | null;
};

export type Pallet = {
  id: string;
  palletLicensePlate: string;
  skuId: string;
  quantity: number;
  receivedAt: string;
  currentLocationId: string | null;
  status: "AVAILABLE" | "IN_TRANSIT" | "CONSUMED" | "HOLD";
  sku?: Sku;
  currentLocation?: Location | null;
};

export type MoveTransaction = {
  id: string;
  palletId: string;
  skuId: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  movedBy: string;
  movedAt: string;
  reasonCode: string;
  notes: string | null;
  pallet?: Pallet;
  sku?: Sku;
  fromLocation?: Location | null;
  toLocation?: Location | null;
};

export type MoveDestinationCategory = "recommended" | "allowed" | "occupied" | "invalid";

export type MoveDestination = {
  category: MoveDestinationCategory;
  reasons: string[];
  location: Location;
};

export type InboundSuggestion = {
  isAllowed: boolean;
  score: number;
  reasons: Array<{ code: string; label: string }>;
  location: {
    id: string;
    fullLocationCode: string;
    areaName: string;
    areaType: AreaType;
    travelSequence: number | null;
  };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? "API request failed");
  }

  return response.json() as Promise<T>;
}

export const api = {
  listLocations: () => request<{ locations: Location[] }>("/locations"),
  listPallets: () => request<{ pallets: Pallet[] }>("/pallets"),
  searchSkus: (query: string) => request<{ skus: Sku[] }>(`/skus/search?q=${encodeURIComponent(query)}`),
  listMoves: (limit = 25) => request<{ moves: MoveTransaction[] }>(`/moves?limit=${limit}`),
  getMoveDestinations: (palletId: string) =>
    request<{
      pallet: {
        id: string;
        palletLicensePlate: string;
        sku: Pick<Sku, "id" | "partNumber" | "description" | "velocityClass">;
        currentLocation: Location | null;
      };
      destinations: MoveDestination[];
      summary: Record<MoveDestinationCategory, number>;
    }>(`/move-destinations?palletId=${encodeURIComponent(palletId)}`),
  movePallet: (body: {
    palletId?: string;
    palletLicensePlate?: string;
    toLocationId?: string;
    toLocationCode?: string;
    movedBy: string;
    reasonCode: string;
    notes?: string;
  }) =>
    request<{ pallet: Pallet; move: MoveTransaction }>("/moves", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getInboundSuggestions: (input: { partNumber?: string; skuId?: string; palletQty: number }) => {
    const params = new URLSearchParams();
    if (input.partNumber) params.set("partNumber", input.partNumber);
    if (input.skuId) params.set("skuId", input.skuId);
    params.set("palletQty", String(input.palletQty));
    return request<{ sku: Sku; requestedPalletQty: number; suggestions: InboundSuggestion[] }>(
      `/suggestions/inbound-placement?${params.toString()}`,
    );
  },
};
