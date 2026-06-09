import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PRODUCT_SELECT =
  "id,item_code,description,velocity_class,product_family,pallets_per_full_allocation,lot_number,is_pickable";

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
  isFloorStacked?: boolean;
};

export type Sku = {
  id: number;
  partNumber: string;
  description: string;
  velocityClass: "FAST" | "MEDIUM" | "SLOW" | null;
  productFamily: string | null;
  palletsPerFullAllocation: number | null;
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
  homeSkuId: number | null;
  isFrontHomeSlot: boolean;
  isFlexSlot: boolean;
  allowsOverflow: boolean;
  status: LocationStatus;
  partNumberStart: string | null;
  partNumberEnd: string | null;
  travelSequence: number | null;
  slotRow: number | null;
  slotCol: number | null;
  isShortenedHeight: boolean;
  area?: WarehouseArea;
  homeSku?: Sku | null;
  currentPallet?: Pallet | null;
};

export type Pallet = {
  id: string;
  palletLicensePlate: string;
  skuId: number;
  quantity: number;
  receivedAt: string;
  currentLocationId: string | null;
  status: "AVAILABLE" | "IN_TRANSIT" | "CONSUMED" | "HOLD";
  inboundReceiptId?: string | null;
  sku?: Sku;
  currentLocation?: Location | null;
};

export type MoveTransaction = {
  id: string;
  palletId: string;
  skuId: number;
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

function oneOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function throwIfError(error: unknown): asserts error is null {
  if (error && typeof error === "object" && "message" in error) {
    throw new Error(String(error.message));
  }
}

function mapProduct(row: any): Sku {
  return {
    id: row.id,
    partNumber: row.item_code,
    description: row.description,
    velocityClass: row.velocity_class ?? null,
    productFamily: row.product_family ?? null,
    palletsPerFullAllocation: row.pallets_per_full_allocation ?? null,
    active: row.is_pickable ?? true,
    lotNumber: row.lot_number ?? null,
  };
}

function mapArea(row: any): WarehouseArea {
  return {
    id: row.id,
    name: row.name,
    areaType: row.area_type,
    sortOrder: row.sort_order,
    isFloorStacked: row.is_floor_stacked ?? false,
  };
}

function mapLocation(row: any): Location {
  const currentPallet = oneOrNull(row.current_pallet);
  const currentPalletProduct = currentPallet ? oneOrNull((currentPallet as any).product) : null;
  const homeProduct = oneOrNull(row.home_product);

  return {
    id: row.id,
    areaId: row.area_id,
    zone: row.zone,
    aisle: row.aisle,
    bay: row.bay,
    level: row.level,
    depthPosition: row.depth_position,
    fullLocationCode: row.full_location_code,
    homeSkuId: row.home_product_id ?? null,
    isFrontHomeSlot: row.is_front_home_slot,
    isFlexSlot: row.is_flex_slot,
    allowsOverflow: row.allows_overflow,
    status: row.status,
    partNumberStart: row.part_number_start ?? null,
    partNumberEnd: row.part_number_end ?? null,
    travelSequence: row.travel_sequence ?? null,
    slotRow: row.slot_row ?? null,
    slotCol: row.slot_col ?? null,
    isShortenedHeight: row.is_shortened_height ?? false,
    area: row.area ? mapArea(oneOrNull(row.area)) : undefined,
    homeSku: homeProduct ? mapProduct(homeProduct) : null,
    currentPallet: currentPallet
      ? {
          id: currentPallet.id,
          palletLicensePlate: currentPallet.pallet_license_plate,
          skuId: currentPallet.product_id,
          quantity: currentPallet.quantity,
          receivedAt: currentPallet.received_at,
          currentLocationId: currentPallet.current_location_id,
          status: currentPallet.status,
          sku: currentPalletProduct ? mapProduct(currentPalletProduct) : undefined,
        }
      : null,
  };
}

function mapPallet(row: any): Pallet {
  const product = oneOrNull(row.product);
  const currentLocation = oneOrNull(row.current_location);

  return {
    id: row.id,
    palletLicensePlate: row.pallet_license_plate,
    skuId: row.product_id,
    quantity: row.quantity,
    receivedAt: row.received_at,
    currentLocationId: row.current_location_id ?? null,
    status: row.status,
    inboundReceiptId: row.inbound_receipt_id ?? null,
    sku: product ? mapProduct(product) : undefined,
    currentLocation: currentLocation ? mapLocation(currentLocation) : null,
  };
}

function mapMove(row: any): MoveTransaction {
  return {
    id: row.id,
    palletId: row.pallet_id,
    skuId: row.product_id,
    fromLocationId: row.from_location_id ?? null,
    toLocationId: row.to_location_id ?? null,
    movedBy: row.moved_by,
    movedAt: row.moved_at,
    reasonCode: row.reason_code,
    notes: row.notes ?? null,
    pallet: row.pallet ? mapPallet(row.pallet) : undefined,
    sku: row.product ? mapProduct(row.product) : undefined,
    fromLocation: row.from_location ? mapLocation(row.from_location) : null,
    toLocation: row.to_location ? mapLocation(row.to_location) : null,
  };
}

function isLocationOpen(location: Location): boolean {
  return location.status !== "BLOCKED" && !location.currentPallet;
}

function partNumberInRange(partNumber: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  return partNumber >= start && partNumber <= end;
}

function scoreLocationForSku(sku: Sku, location: Location) {
  const reasons: Array<{ code: string; label: string }> = [];
  let score = 0;
  let isAllowed = true;

  if (location.isFrontHomeSlot && location.homeSkuId !== sku.id) {
    return { isAllowed: false, score, reasons, location: toSuggestionLocation(location), sortTravelSequence: location.travelSequence ?? Number.MAX_SAFE_INTEGER };
  }

  if (location.homeSkuId === sku.id) {
    score += 100;
    reasons.push({ code: "HOME_MATCH", label: "Assigned home slot for this SKU" });
  }

  if (location.area?.areaType === "BACKSTOCK") {
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

  if (location.area?.areaType === "OVERFLOW") {
    score -= 30;
    reasons.push({ code: "TEMP_OVERFLOW", label: "Temporary overflow is lower priority than backstock" });
  }

  if (location.area?.areaType === "OVERFLOW" && !location.allowsOverflow) {
    isAllowed = false;
  }

  if (location.homeSkuId && location.homeSkuId !== sku.id && (!location.isFlexSlot || !location.allowsOverflow)) {
    isAllowed = false;
  }

  if (location.travelSequence !== null) {
    score += Math.max(0, 20 - Math.floor(location.travelSequence / 100));
    reasons.push({ code: "TRAVEL_SEQUENCE", label: "Ranked by simple travel sequence for MVP" });
  }

  return { isAllowed, score, reasons, location: toSuggestionLocation(location), sortTravelSequence: location.travelSequence ?? Number.MAX_SAFE_INTEGER };
}

function toSuggestionLocation(location: Location) {
  return {
    id: location.id,
    fullLocationCode: location.fullLocationCode,
    areaName: location.area?.name ?? "Unassigned Area",
    areaType: location.area?.areaType ?? "BACKSTOCK",
    travelSequence: location.travelSequence,
  };
}

async function fetchProduct(input: { skuId?: number | string; partNumber?: string; inboundReceiptId?: string }) {
  if (input.inboundReceiptId) {
    const { data, error } = await supabase
      .from("inbound_receipts")
      .select(`id, product:products!inbound_receipts_product_id_fkey(${PRODUCT_SELECT})`)
      .eq("id", input.inboundReceiptId)
      .maybeSingle();

    throwIfError(error);
    if (!data?.product) throw new Error("Inbound receipt not found");
    return mapProduct(data.product);
  }

  const query = supabase.from("products").select(PRODUCT_SELECT);
  const { data, error } = input.skuId
    ? await query.eq("id", Number(input.skuId)).maybeSingle()
    : await query.eq("item_code", input.partNumber).maybeSingle();

  throwIfError(error);
  if (!data) throw new Error("SKU not found");
  return mapProduct(data);
}

async function getInboundPlacementSuggestions(input: { partNumber?: string; skuId?: number | string; inboundReceiptId?: string; palletQty: number }) {
  const sku = await fetchProduct(input);
  const locations = await api.listLocations();
  const suggestions = locations.locations
    .filter(isLocationOpen)
    .map((location) => scoreLocationForSku(sku, location))
    .filter((suggestion) => suggestion.isAllowed)
    .sort((a, b) => b.score - a.score || a.sortTravelSequence - b.sortTravelSequence)
    .slice(0, Math.max(input.palletQty, 5));

  return { sku, requestedPalletQty: input.palletQty, suggestions };
}

function classifyMoveDestination({
  location,
  pallet,
  recommendedLocationIds,
  hasOpenNamedBackstock,
}: {
  location: Location;
  pallet: Pallet & { sku: Sku };
  recommendedLocationIds: Set<string>;
  hasOpenNamedBackstock: boolean;
}): MoveDestination {
  const reasons: string[] = [];

  if (location.id === pallet.currentLocationId) {
    reasons.push("This is the pallet's current location.");
    return { category: "invalid", reasons, location };
  }

  if (location.status === "BLOCKED") {
    reasons.push("Location is blocked or unavailable.");
    return { category: "invalid", reasons, location };
  }

  if (location.currentPallet) {
    reasons.push(`Occupied by pallet ${location.currentPallet.palletLicensePlate}.`);
    return { category: "occupied", reasons, location };
  }

  if (location.isFrontHomeSlot && location.homeSkuId !== pallet.skuId) {
    reasons.push("Front home slots are reserved for their assigned SKU.");
    return { category: "invalid", reasons, location };
  }

  const isBorrowingAnotherSkuReserve = Boolean(location.homeSkuId && location.homeSkuId !== pallet.skuId);

  if (isBorrowingAnotherSkuReserve && (!location.isFlexSlot || !location.allowsOverflow)) {
    reasons.push("Borrowed reserve must be marked flex and overflow-capable.");
    return { category: "invalid", reasons, location };
  }

  if (
    isBorrowingAnotherSkuReserve &&
    location.partNumberStart &&
    location.partNumberEnd &&
    (pallet.sku.partNumber < location.partNumberStart || pallet.sku.partNumber > location.partNumberEnd)
  ) {
    reasons.push("Borrowed reserve must stay inside the destination part-number neighborhood.");
    return { category: "invalid", reasons, location };
  }

  if (location.area?.areaType === "OVERFLOW") {
    if (!location.allowsOverflow) {
      reasons.push("Temporary overflow locations must be marked overflow-capable.");
      return { category: "invalid", reasons, location };
    }

    if (hasOpenNamedBackstock) {
      reasons.push("Temporary overflow is reserved until named backstock options are unavailable.");
      return { category: "invalid", reasons, location };
    }

    reasons.push("Temporary overflow is available because no named backstock location is open.");
    return { category: "allowed", reasons, location };
  }

  if (location.homeSkuId === pallet.skuId) reasons.push("Assigned home or reserve location for this SKU.");
  if (location.area?.areaType === "BACKSTOCK") reasons.push("Named backstock is preferred before temporary overflow.");
  if (partNumberInRange(pallet.sku.partNumber, location.partNumberStart, location.partNumberEnd)) {
    reasons.push("Location matches the SKU part-number neighborhood.");
  }
  if (location.isFlexSlot && location.allowsOverflow) reasons.push("Flex overflow-capable slot can be reclaimed later.");

  if (recommendedLocationIds.has(location.id)) {
    reasons.push("Recommended by the live placement ranking.");
    return { category: "recommended", reasons, location };
  }

  if (reasons.length === 0) reasons.push("Open location with no visible rule conflict.");
  return { category: "allowed", reasons, location };
}

async function fetchMove(moveId: string) {
  const { data, error } = await supabase
    .from("move_transactions")
    .select(
      `
        *,
        pallet:pallets(*),
        product:products!move_transactions_product_id_fkey(${PRODUCT_SELECT}),
        from_location:locations!move_transactions_from_location_id_fkey(*, area:warehouse_areas(*)),
        to_location:locations!move_transactions_to_location_id_fkey(*, area:warehouse_areas(*))
      `,
    )
    .eq("id", moveId)
    .maybeSingle();

  throwIfError(error);
  if (!data) throw new Error("Move not found after move");
  return mapMove(data);
}

export type Family = "fiber" | "accessories" | "plush8" | "plush16_lower" | "plush16_upper" | "clothing";

export type RoutingRow = {
  family: Family;
  itemCodeMin: string | null;
  itemCodeMax: string | null;
  areaId: string;
  rank: number;
};

export type PutawayAssignment = {
  palletIndex: number;   // 1-based within the SKU
  palletOf: number;
  location: Location | null;  // null = no slot found (needs manual)
  needsApproval: boolean;     // true when the assigned slot is shortened-height (requires manual OK)
  options: Location[];        // alternative open slots for manual override
};

export type PutawaySkuPlan = {
  itemCode: string;
  description: string;
  family: Family | null;
  qty: number;
  assignments: PutawayAssignment[];
};

// Derive a SKU's routing family from item_code + description.
export function skuFamily(itemCode: string, description?: string): Family | null {
  const code = (itemCode || "").trim();
  const desc = (description || "").toLowerCase();
  const num = /^\d+$/.test(code) ? parseInt(code, 10) : NaN;
  // Fiber SKUs use the 31xxx item-code prefix (e.g. 31001-ECo, 31002-ZOO),
  // or say "fiber"/"stuffing" in the description.
  if (/^31\d*/.test(code) || desc.includes("fiber") || desc.includes("stuffing")) return "fiber";
  if (/(outfit|hoodie|dress|shirt|pajama|costume|tutu|cape|sweater|overall|romper)/.test(desc)) return "clothing";
  if (/(shoe|sandal|glasses|backpack|collar)/.test(desc)) return "accessories";
  if (!Number.isNaN(num)) {
    if (num >= 50000 && num <= 50999) return "plush8";
    if (num >= 57000 && num <= 99999) return num <= 60725 ? "plush16_lower" : "plush16_upper";
  }
  if (desc.trim().startsWith("8")) return "plush8";
  if (desc.trim().startsWith("16")) return num && num > 60725 ? "plush16_upper" : "plush16_lower";
  return null;
}

export const api = {
  async listLocations() {
    const { data, error } = await supabase
      .from("locations")
      .select(
        `
          *,
          area:warehouse_areas(*),
          home_product:products!locations_home_product_id_fkey(${PRODUCT_SELECT}),
          current_pallet:pallets!pallets_current_location_id_fkey(
            *,
            product:products!pallets_product_id_fkey(${PRODUCT_SELECT})
          )
        `,
      )
      .order("zone", { ascending: true })
      .order("aisle", { ascending: true })
      .order("bay", { ascending: true })
      .order("level", { ascending: true })
      .order("depth_position", { ascending: true });

    throwIfError(error);
    return { locations: (data ?? []).map(mapLocation) };
  },

  async listPallets() {
    const { data, error } = await supabase
      .from("pallets")
      .select(
        `
          *,
          product:products!pallets_product_id_fkey(${PRODUCT_SELECT}),
          current_location:locations(
            *,
            area:warehouse_areas(*),
            home_product:products!locations_home_product_id_fkey(${PRODUCT_SELECT})
          ),
          inbound_receipt:inbound_receipts(*)
        `,
      )
      .neq("status", "CONSUMED")
      .order("pallet_license_plate", { ascending: true });

    throwIfError(error);
    return { pallets: (data ?? []).map(mapPallet) };
  },

  async searchSkus(query: string) {
    const term = query.replaceAll("%", "\\%");
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_pickable", true)
      .or(`item_code.ilike.%${term}%,description.ilike.%${term}%,product_family.ilike.%${term}%`)
      .order("item_code", { ascending: true })
      .limit(25);

    throwIfError(error);

    const skus = (data ?? []).map(mapProduct);
    const productIds = skus.map((sku) => sku.id);

    if (productIds.length === 0) {
      return { skus };
    }

    const [homeLocationsResult, palletsResult] = await Promise.all([
      supabase
        .from("locations")
        .select(
          `
            *,
            area:warehouse_areas(*),
            current_pallet:pallets!pallets_current_location_id_fkey(*)
          `,
        )
        .in("home_product_id", productIds)
        .order("full_location_code", { ascending: true }),
      supabase
        .from("pallets")
        .select(
          `
            *,
            current_location:locations(*, area:warehouse_areas(*))
          `,
        )
        .in("product_id", productIds)
        .order("pallet_license_plate", { ascending: true }),
    ]);

    throwIfError(homeLocationsResult.error);
    throwIfError(palletsResult.error);

    const locationsByProduct = new Map<number, Location[]>();
    for (const location of (homeLocationsResult.data ?? []).map(mapLocation)) {
      if (!location.homeSkuId) continue;
      locationsByProduct.set(location.homeSkuId, [...(locationsByProduct.get(location.homeSkuId) ?? []), location]);
    }

    const palletsByProduct = new Map<number, Pallet[]>();
    for (const pallet of (palletsResult.data ?? []).map(mapPallet)) {
      palletsByProduct.set(pallet.skuId, [...(palletsByProduct.get(pallet.skuId) ?? []), pallet]);
    }

    return {
      skus: skus.map((sku) => ({
        ...sku,
        homeLocations: locationsByProduct.get(sku.id) ?? [],
        pallets: palletsByProduct.get(sku.id) ?? [],
      })),
    };
  },

  async listMoves(limit = 25) {
    const { data, error } = await supabase
      .from("move_transactions")
      .select(
        `
          *,
          pallet:pallets(*),
          product:products!move_transactions_product_id_fkey(${PRODUCT_SELECT}),
          from_location:locations!move_transactions_from_location_id_fkey(*, area:warehouse_areas(*)),
          to_location:locations!move_transactions_to_location_id_fkey(*, area:warehouse_areas(*))
        `,
      )
      .order("moved_at", { ascending: false })
      .limit(limit);

    throwIfError(error);
    return { moves: (data ?? []).map(mapMove) };
  },

  async getMoveDestinations(palletId: string) {
    const palletResponse = await this.listPallets();
    const pallet = palletResponse.pallets.find((item) => item.id === palletId);
    if (!pallet?.sku) throw new Error("Pallet not found");

    const locationResponse = await this.listLocations();
    const recommendations = await getInboundPlacementSuggestions({ skuId: pallet.skuId, palletQty: 5 });
    const recommendedLocationIds = new Set(recommendations.suggestions.map((suggestion) => suggestion.location.id));
    const hasOpenNamedBackstock = locationResponse.locations.some(
      (location) => location.area?.areaType === "BACKSTOCK" && location.status !== "BLOCKED" && !location.currentPallet,
    );

    const destinations = locationResponse.locations
      .map((location) =>
        classifyMoveDestination({
          location,
          pallet: pallet as Pallet & { sku: Sku },
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
          (a.location.area?.sortOrder ?? 999) - (b.location.area?.sortOrder ?? 999) ||
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
        currentLocation: pallet.currentLocation ?? null,
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
  },

  async movePallet(body: {
    palletId?: string;
    palletLicensePlate?: string;
    toLocationId?: string;
    toLocationCode?: string;
    movedBy: string;
    reasonCode: string;
    notes?: string;
  }) {
    const { data, error } = await supabase.rpc("move_pallet", {
      input: {
        pallet_id: body.palletId ?? null,
        pallet_license_plate: body.palletLicensePlate ?? null,
        to_location_id: body.toLocationId ?? null,
        to_location_code: body.toLocationCode ?? null,
        moved_by: body.movedBy,
        reason_code: body.reasonCode,
        notes: body.notes ?? null,
      },
    });

    throwIfError(error);

    const palletId = data?.palletId as string | undefined;
    const moveId = data?.moveId as string | undefined;
    if (!palletId || !moveId) throw new Error("Move RPC did not return pallet and move ids");

    const [pallets, move] = await Promise.all([this.listPallets(), fetchMove(moveId)]);
    const pallet = pallets.pallets.find((item) => item.id === palletId);
    if (!pallet) throw new Error("Pallet not found after move");

    return { pallet, move };
  },

  getInboundSuggestions: getInboundPlacementSuggestions,

  async listBackstockRouting(): Promise<RoutingRow[]> {
    const { data, error } = await supabase
      .from("backstock_routing")
      .select("family,item_code_min,item_code_max,backstock_area_id,rank")
      .order("rank", { ascending: true });
    throwIfError(error);
    return (data ?? []).map((r: any) => ({
      family: r.family,
      itemCodeMin: r.item_code_min ?? null,
      itemCodeMax: r.item_code_max ?? null,
      areaId: r.backstock_area_id,
      rank: r.rank,
    }));
  },

  // Capacity-greedy putaway plan for a container manifest.
  // For each SKU: family -> eligible areas (routing) ranked by LIVE open-slot count
  // (most room first), fill roomiest first one-pallet-per-slot, cascade as each fills;
  // then any other non-Whitefish area with space; then Whitefish (global last resort);
  // remaining pallets get location=null (manual).
  async planContainerPutaway(
    manifest: Array<{ itemCode: string; qty: number }>,
  ): Promise<PutawaySkuPlan[]> {
    const [{ locations }, routing, productResp] = await Promise.all([
      this.listLocations(),
      this.listBackstockRouting(),
      supabase.from("products").select("item_code,description"),
    ]);
    const descByCode = new Map<string, string>();
    for (const p of (productResp.data ?? []) as any[]) descByCode.set(p.item_code, p.description ?? "");

    // open slots grouped by area, plus area meta
    const openByArea = new Map<string, Location[]>();
    const areaName = new Map<string, string>();
    const areaIsLastResort = new Map<string, boolean>();
    for (const loc of locations) {
      if (loc.area) {
        areaName.set(loc.area.id, loc.area.name);
        areaIsLastResort.set(loc.area.id, Boolean((loc.area as any).isLastResort));
      }
      const open = loc.status !== "BLOCKED" && !loc.currentPallet;
      if (open && loc.areaId) {
        openByArea.set(loc.areaId, [...(openByArea.get(loc.areaId) ?? []), loc]);
      }
    }
    // stable slot order within an area: bay, depth, level
    for (const [, arr] of openByArea) {
      arr.sort(
        (a, b) =>
          a.bay.localeCompare(b.bay, undefined, { numeric: true }) ||
          a.depthPosition - b.depthPosition ||
          a.level.localeCompare(b.level, undefined, { numeric: true }),
      );
    }

    // a mutable cursor of consumed slots so two SKUs don't claim the same slot
    const consumed = new Set<string>();

    const lastResortAreaIds = [...areaIsLastResort.entries()].filter(([, v]) => v).map(([k]) => k);

    return manifest
      .filter((m) => m.itemCode && m.qty > 0)
      .map((m) => {
        const fam = skuFamily(m.itemCode, descByCode.get(m.itemCode));
        const eligible = fam
          ? Array.from(new Set(routing.filter((r) => r.family === fam).map((r) => r.areaId)))
          : [];
        // build the cascade order of area ids to try:
        // 1) eligible areas (sorted by current open capacity desc, recomputed greedily)
        // 2) any other non-last-resort area with space
        // 3) last-resort areas (Whitefish)
        const assignments: PutawayAssignment[] = [];
        // Normal (full-height) slots are always preferred. Shortened-height slots are a
        // LAST RESORT — only used after every NORMAL slot everywhere is exhausted, and
        // when chosen they are flagged needsApproval (manual OK required).
        function takeFrom(areaId: string, shortOnly: boolean): Location | undefined {
          return (openByArea.get(areaId) ?? []).find(
            (l) => !consumed.has(l.id) && Boolean(l.isShortenedHeight) === shortOnly,
          );
        }
        function remainingFrom(areaId: string, shortOnly: boolean): number {
          return (openByArea.get(areaId) ?? []).filter(
            (l) => !consumed.has(l.id) && Boolean(l.isShortenedHeight) === shortOnly,
          ).length;
        }
        function pickArea(shortOnly: boolean): string | undefined {
          const elig = eligible.filter((a) => remainingFrom(a, shortOnly) > 0)
            .sort((a, b) => remainingFrom(b, shortOnly) - remainingFrom(a, shortOnly));
          if (elig.length) return elig[0];
          const others = [...openByArea.keys()]
            .filter((a) => !eligible.includes(a) && !areaIsLastResort.get(a) && remainingFrom(a, shortOnly) > 0)
            .sort((a, b) => remainingFrom(b, shortOnly) - remainingFrom(a, shortOnly));
          if (others.length) return others[0];
          const lr = lastResortAreaIds.filter((a) => remainingFrom(a, shortOnly) > 0)
            .sort((a, b) => remainingFrom(b, shortOnly) - remainingFrom(a, shortOnly));
          return lr[0];
        }
        for (let k = 0; k < m.qty; k++) {
          let loc: Location | null = null;
          let needsApproval = false;
          // pass 1: normal slots
          let area = pickArea(false);
          if (area) {
            const slot = takeFrom(area, false);
            if (slot) { loc = slot; consumed.add(slot.id); }
          }
          // pass 2: shortened-height slots (last resort, requires approval)
          if (!loc) {
            area = pickArea(true);
            if (area) {
              const slot = takeFrom(area, true);
              if (slot) { loc = slot; consumed.add(slot.id); needsApproval = true; }
            }
          }
          // up to 4 alternative open slots for manual override (normal first, then short)
          const options: Location[] = [];
          for (const shortOnly of [false, true]) {
            for (const a of [...eligible, ...openByArea.keys()]) {
              for (const l of openByArea.get(a) ?? []) {
                if (l.id !== loc?.id && !consumed.has(l.id) && Boolean(l.isShortenedHeight) === shortOnly && options.length < 4) options.push(l);
              }
            }
          }
          assignments.push({ palletIndex: k + 1, palletOf: m.qty, location: loc, needsApproval, options });
        }
        return {
          itemCode: m.itemCode,
          description: descByCode.get(m.itemCode) ?? "",
          family: fam,
          qty: m.qty,
          assignments,
        };
      });
  },

  // Commit a putaway plan: create pallets + INBOUND_PUTAWAY move rows.
  async commitPutaway(
    placements: Array<{ itemCode: string; locationId: string }>,
    movedBy = "warehouse.demo",
  ): Promise<{ placed: number }> {
    if (!placements.length) return { placed: 0 };
    // resolve product ids
    const codes = Array.from(new Set(placements.map((p) => p.itemCode)));
    const { data: prods, error: prodErr } = await supabase
      .from("products")
      .select("id,item_code")
      .in("item_code", codes);
    throwIfError(prodErr);
    const idByCode = new Map<string, number>();
    for (const p of (prods ?? []) as any[]) idByCode.set(p.item_code, p.id);

    let seq = Date.now() % 100000;
    const palletRows = placements.map((p) => ({
      pallet_license_plate: `LP-IN${(seq++).toString().padStart(6, "0")}`,
      product_id: idByCode.get(p.itemCode),
      quantity: 1,
      received_at: new Date().toISOString(),
      current_location_id: p.locationId,
      status: "AVAILABLE",
    }));
    const { data: inserted, error: insErr } = await supabase
      .from("pallets")
      .insert(palletRows)
      .select("id,product_id,current_location_id");
    throwIfError(insErr);

    const moves = (inserted ?? []).map((row: any) => ({
      pallet_id: row.id,
      product_id: row.product_id,
      from_location_id: null,
      to_location_id: row.current_location_id,
      moved_by: movedBy,
      reason_code: "INBOUND_PUTAWAY",
    }));
    if (moves.length) {
      const { error: mvErr } = await supabase.from("move_transactions").insert(moves);
      throwIfError(mvErr);
    }
    // mark locations occupied
    const locIds = placements.map((p) => p.locationId);
    const { error: locErr } = await supabase
      .from("locations")
      .update({ status: "OCCUPIED_HOME_SKU" })
      .in("id", locIds);
    throwIfError(locErr);

    return { placed: placements.length };
  },
};
