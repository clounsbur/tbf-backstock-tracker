export const AreaType = {
  FRONT_HOME: "FRONT_HOME",
  BACKSTOCK: "BACKSTOCK",
  FLEX_RESERVE: "FLEX_RESERVE",
  OVERFLOW: "OVERFLOW",
  RECEIVING: "RECEIVING",
} as const;

export type AreaType = (typeof AreaType)[keyof typeof AreaType];

export const LocationStatus = {
  OPEN: "OPEN",
  OCCUPIED_HOME_SKU: "OCCUPIED_HOME_SKU",
  OCCUPIED_OVERFLOW_SKU: "OCCUPIED_OVERFLOW_SKU",
  RESERVED_HOME_SLOT: "RESERVED_HOME_SLOT",
  OPEN_FLEX_SLOT: "OPEN_FLEX_SLOT",
  BLOCKED: "BLOCKED",
} as const;

export type LocationStatus = (typeof LocationStatus)[keyof typeof LocationStatus];

export const PalletStatus = {
  AVAILABLE: "AVAILABLE",
  IN_TRANSIT: "IN_TRANSIT",
  CONSUMED: "CONSUMED",
  HOLD: "HOLD",
} as const;

export type PalletStatus = (typeof PalletStatus)[keyof typeof PalletStatus];

export type MoveReasonCode =
  | "STANDARD_MOVE"
  | "INBOUND_PUTAWAY"
  | "OVERFLOW_RELOCATION"
  | "RECLAIM_HOME_SLOT"
  | "CONSOLIDATION"
  | "ADJUSTMENT";

export type VelocityClass = "FAST" | "MEDIUM" | "SLOW";

export type ProductSku = {
  id: number;
  partNumber: string;
  description: string;
  velocityClass: VelocityClass | null;
  productFamily: string | null;
  palletsPerFullAllocation: number | null;
  active: boolean;
  lotNumber: string | null;
};

export type WarehouseArea = {
  id: string;
  name: string;
  areaType: AreaType;
  sortOrder: number;
  active?: boolean;
};

export type LocationRecord = {
  id: string;
  areaId: string;
  zone: string;
  aisle: string;
  bay: string;
  level: string;
  depthPosition: number;
  fullLocationCode: string;
  homeSkuId: number | null;
  isFrontHomeSlot: boolean;
  isFlexSlot: boolean;
  allowsOverflow: boolean;
  status: LocationStatus;
  partNumberStart: string | null;
  partNumberEnd: string | null;
  travelSequence: number | null;
  area?: WarehouseArea;
  homeSku?: ProductSku | null;
  currentPallet?: {
    id: string;
    palletLicensePlate: string;
    skuId?: number;
    sku?: Pick<ProductSku, "id" | "partNumber" | "description" | "velocityClass">;
  } | null;
};

export type PalletRecord = {
  id: string;
  palletLicensePlate: string;
  skuId: number;
  quantity: number;
  receivedAt: string;
  currentLocationId: string | null;
  status: PalletStatus;
  inboundReceiptId: string | null;
  sku?: ProductSku;
  currentLocation?: LocationRecord | null;
};
