import { LocationStatus, type Sku } from "@prisma/client";
import { HttpError } from "../httpError.js";

type DestinationForMove = {
  fullLocationCode: string;
  status: LocationStatus;
  homeSkuId: string | null;
  isFrontHomeSlot: boolean;
  isFlexSlot: boolean;
  allowsOverflow: boolean;
  partNumberStart: string | null;
  partNumberEnd: string | null;
  currentPallet: unknown | null;
  area: {
    areaType: string;
  };
};

export function validateLegalMove(sku: Pick<Sku, "id" | "partNumber">, destination: DestinationForMove) {
  if (destination.status === LocationStatus.BLOCKED) {
    throw new HttpError(409, "Destination location is blocked");
  }

  if (destination.currentPallet) {
    throw new HttpError(409, "Destination location is already occupied");
  }

  if (destination.isFrontHomeSlot && destination.homeSkuId !== sku.id) {
    throw new HttpError(409, "Front home slots are reserved for their assigned SKU");
  }

  const isBorrowingAnotherSkuReserve = Boolean(destination.homeSkuId && destination.homeSkuId !== sku.id);

  if (isBorrowingAnotherSkuReserve && (!destination.isFlexSlot || !destination.allowsOverflow)) {
    throw new HttpError(409, "Overflow can only use locations marked as flex overflow-capable");
  }

  if (
    isBorrowingAnotherSkuReserve &&
    destination.partNumberStart &&
    destination.partNumberEnd &&
    (sku.partNumber < destination.partNumberStart || sku.partNumber > destination.partNumberEnd)
  ) {
    throw new HttpError(409, "Overflow must stay within the destination part-number neighborhood");
  }

  if (destination.area.areaType === "OVERFLOW" && !destination.allowsOverflow) {
    throw new HttpError(409, "Temporary overflow locations must be marked overflow-capable");
  }
}
