import {
  type AreaType,
  type LocationRecord,
  type LocationStatus,
  type PalletRecord,
  type PalletStatus,
  type ProductSku,
  type VelocityClass,
  type WarehouseArea,
} from "../domainTypes.js";

export const PRODUCT_SELECT =
  "id,item_code,description,velocity_class,product_family,pallets_per_full_allocation,lot_number,active";

export function oneOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function mapProduct(row: any): ProductSku {
  return {
    id: row.id,
    partNumber: row.item_code,
    description: row.description,
    velocityClass: row.velocity_class as VelocityClass | null,
    productFamily: row.product_family ?? null,
    palletsPerFullAllocation: row.pallets_per_full_allocation ?? null,
    active: row.active,
    lotNumber: row.lot_number ?? null,
  };
}

export function mapArea(row: any): WarehouseArea {
  return {
    id: row.id,
    name: row.name,
    areaType: row.area_type as AreaType,
    sortOrder: row.sort_order,
    active: row.active,
  };
}

export function mapLocation(row: any): LocationRecord {
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
    status: row.status as LocationStatus,
    partNumberStart: row.part_number_start ?? null,
    partNumberEnd: row.part_number_end ?? null,
    travelSequence: row.travel_sequence ?? null,
    area: row.area ? mapArea(oneOrNull(row.area)) : undefined,
    homeSku: homeProduct ? mapProduct(homeProduct) : null,
    currentPallet: currentPallet
      ? {
          id: currentPallet.id,
          palletLicensePlate: currentPallet.pallet_license_plate,
          skuId: currentPallet.product_id,
          sku: currentPalletProduct ? mapProduct(currentPalletProduct) : undefined,
        }
      : null,
  };
}

export function mapPallet(row: any): PalletRecord {
  const product = oneOrNull(row.product);
  const currentLocation = oneOrNull(row.current_location);

  return {
    id: row.id,
    palletLicensePlate: row.pallet_license_plate,
    skuId: row.product_id,
    quantity: row.quantity,
    receivedAt: row.received_at,
    currentLocationId: row.current_location_id ?? null,
    status: row.status as PalletStatus,
    inboundReceiptId: row.inbound_receipt_id ?? null,
    sku: product ? mapProduct(product) : undefined,
    currentLocation: currentLocation ? mapLocation(currentLocation) : null,
  };
}
