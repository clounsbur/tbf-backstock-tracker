import { LocationStatus, type LocationRecord } from "../domainTypes.js";

export function openStatusForLocation(location: Pick<LocationRecord, "isFrontHomeSlot" | "isFlexSlot" | "status">): LocationStatus {
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

export function occupiedStatusForLocation(
  location: Pick<LocationRecord, "homeSkuId" | "isFlexSlot" | "allowsOverflow">,
  skuId: number,
): LocationStatus {
  if (location.homeSkuId && location.homeSkuId !== skuId) {
    return LocationStatus.OCCUPIED_OVERFLOW_SKU;
  }

  if (!location.homeSkuId && location.isFlexSlot && location.allowsOverflow) {
    return LocationStatus.OCCUPIED_OVERFLOW_SKU;
  }

  return LocationStatus.OCCUPIED_HOME_SKU;
}

export function isLocationOpen(location: LocationRecord): boolean {
  return location.status !== LocationStatus.BLOCKED && !location.currentPallet;
}
