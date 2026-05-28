import { AreaType, LocationStatus, type PrismaClient, type Sku } from "@prisma/client";
import { HttpError } from "../httpError.js";
import { getInboundPlacementSuggestions } from "./inboundSuggestionService.js";

export type MoveDestinationCategory = "recommended" | "allowed" | "occupied" | "invalid";

type MoveDestinationLocation = {
  id: string;
  fullLocationCode: string;
  zone: string;
  aisle: string;
  bay: string;
  level: string;
  depthPosition: number;
  homeSkuId: string | null;
  isFrontHomeSlot: boolean;
  isFlexSlot: boolean;
  allowsOverflow: boolean;
  status: LocationStatus;
  partNumberStart: string | null;
  partNumberEnd: string | null;
  travelSequence: number | null;
  area: {
    name: string;
    areaType: AreaType;
    sortOrder: number;
  };
  homeSku?: {
    partNumber: string;
    description: string;
  } | null;
  currentPallet?: {
    id: string;
    palletLicensePlate: string;
    sku?: {
      partNumber: string;
    };
  } | null;
};

type MoveDestinationPallet = {
  id: string;
  palletLicensePlate: string;
  skuId: string;
  currentLocationId: string | null;
  sku: Pick<Sku, "id" | "partNumber" | "description" | "velocityClass">;
};

export async function getMoveDestinations(prisma: PrismaClient, palletId: string) {
  const pallet = await prisma.pallet.findUnique({
    where: { id: palletId },
    include: {
      sku: true,
      currentLocation: true,
    },
  });

  if (!pallet) {
    throw new HttpError(404, "Pallet not found");
  }

  const locations = await prisma.location.findMany({
    include: {
      area: true,
      homeSku: {
        select: {
          partNumber: true,
          description: true,
        },
      },
      currentPallet: {
        include: {
          sku: {
            select: {
              partNumber: true,
            },
          },
        },
      },
    },
    orderBy: [
      { zone: "asc" },
      { aisle: "asc" },
      { bay: "asc" },
      { depthPosition: "asc" },
    ],
  });

  const recommendations = await getInboundPlacementSuggestions(prisma, {
    skuId: pallet.skuId,
    palletQty: 5,
  });

  const recommendedLocationIds = new Set(recommendations.suggestions.map((suggestion) => suggestion.location.id));
  const hasOpenNamedBackstock = locations.some((location) => isOpenNamedBackstock(location));

  const destinations = locations
    .map((location) =>
      classifyMoveDestination({
        location,
        pallet,
        recommendedLocationIds,
        hasOpenNamedBackstock,
      }),
    )
    .sort((a, b) => {
      const categoryOrder: Record<MoveDestinationCategory, number> = {
        recommended: 0,
        allowed: 1,
        occupied: 2,
        invalid: 3,
      };

      return (
        categoryOrder[a.category] - categoryOrder[b.category] ||
        (a.location.area.sortOrder ?? 999) - (b.location.area.sortOrder ?? 999) ||
        (a.location.travelSequence ?? 9999) - (b.location.travelSequence ?? 9999) ||
        a.location.fullLocationCode.localeCompare(b.location.fullLocationCode)
      );
    });

  return {
    pallet: {
      id: pallet.id,
      palletLicensePlate: pallet.palletLicensePlate,
      sku: {
        id: pallet.sku.id,
        partNumber: pallet.sku.partNumber,
        description: pallet.sku.description,
        velocityClass: pallet.sku.velocityClass,
      },
      currentLocation: pallet.currentLocation,
    },
    destinations,
    summary: destinations.reduce(
      (counts, destination) => ({
        ...counts,
        [destination.category]: counts[destination.category] + 1,
      }),
      { recommended: 0, allowed: 0, occupied: 0, invalid: 0 } satisfies Record<MoveDestinationCategory, number>,
    ),
  };
}

export function classifyMoveDestination({
  location,
  pallet,
  recommendedLocationIds,
  hasOpenNamedBackstock,
}: {
  location: MoveDestinationLocation;
  pallet: MoveDestinationPallet;
  recommendedLocationIds: Set<string>;
  hasOpenNamedBackstock: boolean;
}) {
  const reasons: string[] = [];

  if (location.id === pallet.currentLocationId) {
    reasons.push("This is the pallet's current location.");
    return toDestination(location, "invalid", reasons);
  }

  if (location.status === LocationStatus.BLOCKED) {
    reasons.push("Location is blocked or unavailable.");
    return toDestination(location, "invalid", reasons);
  }

  if (location.currentPallet) {
    reasons.push(`Occupied by pallet ${location.currentPallet.palletLicensePlate}.`);
    return toDestination(location, "occupied", reasons);
  }

  if (location.isFrontHomeSlot && location.homeSkuId !== pallet.skuId) {
    reasons.push("Front home slots are reserved for their assigned SKU.");
    return toDestination(location, "invalid", reasons);
  }

  const isBorrowingAnotherSkuReserve = Boolean(location.homeSkuId && location.homeSkuId !== pallet.skuId);

  if (isBorrowingAnotherSkuReserve && (!location.isFlexSlot || !location.allowsOverflow)) {
    reasons.push("Borrowed reserve must be marked flex and overflow-capable.");
    return toDestination(location, "invalid", reasons);
  }

  if (
    isBorrowingAnotherSkuReserve &&
    location.partNumberStart &&
    location.partNumberEnd &&
    (pallet.sku.partNumber < location.partNumberStart || pallet.sku.partNumber > location.partNumberEnd)
  ) {
    reasons.push("Borrowed reserve must stay inside the destination part-number neighborhood.");
    return toDestination(location, "invalid", reasons);
  }

  if (location.area.areaType === AreaType.OVERFLOW) {
    if (!location.allowsOverflow) {
      reasons.push("Temporary overflow locations must be marked overflow-capable.");
      return toDestination(location, "invalid", reasons);
    }

    if (hasOpenNamedBackstock) {
      reasons.push("Temporary overflow is reserved until named backstock options are unavailable.");
      return toDestination(location, "invalid", reasons);
    }

    reasons.push("Temporary overflow is available because no named backstock location is open.");
    return toDestination(location, "allowed", reasons);
  }

  if (location.homeSkuId === pallet.skuId) {
    reasons.push("Assigned home or reserve location for this SKU.");
  }

  if (location.area.areaType === AreaType.BACKSTOCK) {
    reasons.push("Named backstock is preferred before temporary overflow.");
  }

  if (partNumberInRange(pallet.sku.partNumber, location.partNumberStart, location.partNumberEnd)) {
    reasons.push("Location matches the SKU part-number neighborhood.");
  }

  if (location.isFlexSlot && location.allowsOverflow) {
    reasons.push("Flex overflow-capable slot can be reclaimed later.");
  }

  if (recommendedLocationIds.has(location.id)) {
    reasons.push("Recommended by the live placement ranking.");
    return toDestination(location, "recommended", reasons);
  }

  if (reasons.length === 0) {
    reasons.push("Open location with no visible rule conflict.");
  }

  return toDestination(location, "allowed", reasons);
}

function isOpenNamedBackstock(location: MoveDestinationLocation) {
  return location.area.areaType === AreaType.BACKSTOCK && location.status !== LocationStatus.BLOCKED && !location.currentPallet;
}

function partNumberInRange(partNumber: string, start: string | null, end: string | null): boolean {
  if (!start || !end) {
    return false;
  }

  return partNumber >= start && partNumber <= end;
}

function toDestination(location: MoveDestinationLocation, category: MoveDestinationCategory, reasons: string[]) {
  return {
    category,
    reasons,
    location: {
      id: location.id,
      fullLocationCode: location.fullLocationCode,
      zone: location.zone,
      aisle: location.aisle,
      bay: location.bay,
      level: location.level,
      depthPosition: location.depthPosition,
      status: location.status,
      isFrontHomeSlot: location.isFrontHomeSlot,
      isFlexSlot: location.isFlexSlot,
      allowsOverflow: location.allowsOverflow,
      partNumberStart: location.partNumberStart,
      partNumberEnd: location.partNumberEnd,
      travelSequence: location.travelSequence,
      area: location.area,
      homeSku: location.homeSku,
      currentPallet: location.currentPallet,
    },
  };
}
