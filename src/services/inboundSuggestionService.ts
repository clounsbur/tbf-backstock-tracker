import { type InventorySupabaseClient } from "../supabase.js";
import { AreaType, LocationStatus, type LocationRecord, type ProductSku } from "../domainTypes.js";
import { HttpError } from "../httpError.js";
import { isLocationOpen } from "./locationStatus.js";
import { mapLocation, mapProduct, PRODUCT_SELECT } from "./supabaseMappers.js";

type SuggestionInput = {
  skuId?: number | string;
  partNumber?: string;
  inboundReceiptId?: string;
  palletQty: number;
};

type CandidateReason = {
  code: string;
  label: string;
};

export async function getInboundPlacementSuggestions(supabase: InventorySupabaseClient, input: SuggestionInput) {
  const sku = await resolveSku(supabase, input);

  const { data, error } = await supabase
    .from("locations")
    .select(
      `
        *,
        area:warehouse_areas(*),
        home_product:products!locations_home_product_id_fkey(${PRODUCT_SELECT}),
        current_pallet:pallets!pallets_current_location_id_fkey(*)
      `,
    )
    .neq("status", LocationStatus.BLOCKED)
    .order("travel_sequence", { ascending: true, nullsFirst: false })
    .order("full_location_code", { ascending: true });

  if (error) {
    throw error;
  }

  const candidateLocations = (data ?? []).map(mapLocation);

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

async function resolveSku(supabase: InventorySupabaseClient, input: SuggestionInput): Promise<ProductSku> {
  if (input.inboundReceiptId) {
    const { data: receipt, error } = await supabase
      .from("inbound_receipts")
      .select(`id, product:products!inbound_receipts_product_id_fkey(${PRODUCT_SELECT})`)
      .eq("id", input.inboundReceiptId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!receipt || !receipt.product) {
      throw new HttpError(404, "Inbound receipt not found");
    }

    return mapProduct(receipt.product);
  }

  const query = supabase.from("products").select(PRODUCT_SELECT);
  const { data: sku, error } = input.skuId
    ? await query.eq("id", Number(input.skuId)).maybeSingle()
    : await query.eq("item_code", input.partNumber).maybeSingle();

  if (error) {
    throw error;
  }

  if (!sku) {
    throw new HttpError(404, "SKU not found");
  }

  return mapProduct(sku);
}

function scoreLocationForSku(
  sku: ProductSku,
  location: LocationRecord,
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

  if (location.area?.areaType === AreaType.BACKSTOCK) {
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

  if (location.area?.areaType === AreaType.OVERFLOW) {
    score -= 30;
    reasons.push({ code: "TEMP_OVERFLOW", label: "Temporary overflow is lower priority than backstock" });
  }

  if (location.area?.areaType === AreaType.OVERFLOW && !location.allowsOverflow) {
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

function toLocationSummary(location: LocationRecord) {
  return {
    id: location.id,
    fullLocationCode: location.fullLocationCode,
    areaName: location.area?.name ?? "Unassigned Area",
    areaType: location.area?.areaType ?? AreaType.BACKSTOCK,
    travelSequence: location.travelSequence,
  };
}
