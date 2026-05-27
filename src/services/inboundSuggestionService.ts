import { AreaType, LocationStatus, type PrismaClient, type Sku } from "@prisma/client";
import { HttpError } from "../httpError.js";
import { isLocationOpen } from "./locationStatus.js";

type SuggestionInput = {
  skuId?: string;
  partNumber?: string;
  inboundReceiptId?: string;
  palletQty: number;
};

type CandidateReason = {
  code: string;
  label: string;
};

export async function getInboundPlacementSuggestions(prisma: PrismaClient, input: SuggestionInput) {
  const sku = await resolveSku(prisma, input);

  const candidateLocations = await prisma.location.findMany({
    where: {
      status: {
        not: LocationStatus.BLOCKED,
      },
    },
    include: {
      area: true,
      homeSku: true,
      currentPallet: true,
    },
    orderBy: [
      { travelSequence: "asc" },
      { fullLocationCode: "asc" },
    ],
  });

  const suggestions = candidateLocations
    .filter((location) => isLocationOpen(location))
    .map((location) => scoreLocationForSku(sku, location))
    .filter((suggestion) => suggestion.isAllowed)
    .sort((a, b) => b.score - a.score || a.sortTravelSequence - b.sortTravelSequence)
    .slice(0, Math.max(input.palletQty, 5));

  return {
    sku,
    requestedPalletQty: input.palletQty,
    suggestions,
  };
}

async function resolveSku(prisma: PrismaClient, input: SuggestionInput): Promise<Sku> {
  if (input.inboundReceiptId) {
    const receipt = await prisma.inboundReceipt.findUnique({
      where: { id: input.inboundReceiptId },
      include: { sku: true },
    });

    if (!receipt) {
      throw new HttpError(404, "Inbound receipt not found");
    }

    return receipt.sku;
  }

  const sku = await prisma.sku.findFirst({
    where: input.skuId ? { id: input.skuId } : { partNumber: input.partNumber },
  });

  if (!sku) {
    throw new HttpError(404, "SKU not found");
  }

  return sku;
}

function scoreLocationForSku(
  sku: Sku,
  location: {
    id: string;
    fullLocationCode: string;
    area: { name: string; areaType: AreaType };
    homeSkuId: string | null;
    isFrontHomeSlot: boolean;
    isFlexSlot: boolean;
    allowsOverflow: boolean;
    partNumberStart: string | null;
    partNumberEnd: string | null;
    travelSequence: number | null;
  },
) {
  const reasons: CandidateReason[] = [];
  let score = 0;
  let isAllowed = true;

  if (location.isFrontHomeSlot && location.homeSkuId !== sku.id) {
    return {
      isAllowed: false,
      score,
      reasons,
      location: toLocationSummary(location),
      sortTravelSequence: location.travelSequence ?? Number.MAX_SAFE_INTEGER,
    };
  }

  if (location.homeSkuId === sku.id) {
    score += 100;
    reasons.push({ code: "HOME_MATCH", label: "Assigned home slot for this SKU" });
  }

  if (location.area.areaType === AreaType.BACKSTOCK) {
    score += 40;
    reasons.push({ code: "BACKSTOCK_FIRST", label: "Uses named backstock before temporary overflow" });
  }

  if (partNumberInRange(sku.partNumber, location.partNumberStart, location.partNumberEnd)) {
    score += 25;
    reasons.push({ code: "PART_RANGE", label: "Matches the location part-number neighborhood" });
  }

  if (location.isFlexSlot && location.allowsOverflow) {
    score += location.homeSkuId === sku.id ? 20 : 5;
    reasons.push({ code: "FLEX_REVERSIBLE", label: "Flex slot can be reclaimed later" });
  }

  if (location.area.areaType === AreaType.OVERFLOW) {
    score -= 30;
    reasons.push({ code: "TEMP_OVERFLOW", label: "Temporary overflow is lower priority than backstock" });
  }

  if (location.area.areaType === AreaType.OVERFLOW && !location.allowsOverflow) {
    isAllowed = false;
  }

  if (location.homeSkuId && location.homeSkuId !== sku.id && (!location.isFlexSlot || !location.allowsOverflow)) {
    isAllowed = false;
  }

  if (location.travelSequence !== null) {
    score += Math.max(0, 20 - Math.floor(location.travelSequence / 100));
    reasons.push({ code: "TRAVEL_SEQUENCE", label: "Ranked by simple travel sequence for MVP" });
  }

  return {
    isAllowed,
    score,
    reasons,
    location: toLocationSummary(location),
    sortTravelSequence: location.travelSequence ?? Number.MAX_SAFE_INTEGER,
  };
}

function partNumberInRange(partNumber: string, start: string | null, end: string | null): boolean {
  if (!start || !end) {
    return false;
  }

  return partNumber >= start && partNumber <= end;
}

function toLocationSummary(location: {
  id: string;
  fullLocationCode: string;
  area: { name: string; areaType: AreaType };
  travelSequence: number | null;
}) {
  return {
    id: location.id,
    fullLocationCode: location.fullLocationCode,
    areaName: location.area.name,
    areaType: location.area.areaType,
    travelSequence: location.travelSequence,
  };
}
