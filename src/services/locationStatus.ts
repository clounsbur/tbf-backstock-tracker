import { LocationStatus, type Location, type Pallet } from "@prisma/client";

type LocationWithPallet = Location & {
  currentPallet?: (Pallet & { skuId: string }) | null;
};

export function openStatusForLocation(location: Pick<Location, "isFrontHomeSlot" | "isFlexSlot" | "status">): LocationStatus {
  if (location.status === LocationStatus.BLOCKED) {
    return LocationStatus.BLOCKED;
  }

  if (location.isFrontHomeSlot) {
    return LocationStatus.RESERVED_HOME_SLOT;
  }

  if (location.isFlexSlot) {
    return LocationStatus.OPEN_FLEX_SLOT;
  }

  return LocationStatus.OPEN;
}

export function occupiedStatusForLocation(location: Pick<Location, "homeSkuId" | "isFlexSlot" | "allowsOverflow">, skuId: string): LocationStatus {
  if (location.homeSkuId && location.homeSkuId !== skuId) {
    return LocationStatus.OCCUPIED_OVERFLOW_SKU;
  }

  if (!location.homeSkuId && location.isFlexSlot && location.allowsOverflow) {
    return LocationStatus.OCCUPIED_OVERFLOW_SKU;
  }

  return LocationStatus.OCCUPIED_HOME_SKU;
}

export function isLocationOpen(location: LocationWithPallet): boolean {
  return location.status !== LocationStatus.BLOCKED && !location.currentPallet;
}
