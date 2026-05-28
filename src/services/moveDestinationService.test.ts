import { strict as assert } from "node:assert";
import { AreaType, LocationStatus, VelocityClass } from "@prisma/client";
import { classifyMoveDestination } from "./moveDestinationService.js";

const pallet = {
  id: "pallet-1",
  palletLicensePlate: "PLT-1",
  skuId: "sku-100220",
  currentLocationId: "current-location",
  sku: {
    id: "sku-100220",
    partNumber: "100220",
    description: "Widget bearing kit",
    velocityClass: VelocityClass.MEDIUM,
  },
};

function location(overrides: Record<string, unknown> = {}) {
  return {
    id: "location-1",
    fullLocationCode: "BACKSTOCK-2-B02-001-L1-D1",
    zone: "BACKSTOCK-2",
    aisle: "B02",
    bay: "001",
    level: "L1",
    depthPosition: 1,
    homeSkuId: null,
    isFrontHomeSlot: false,
    isFlexSlot: false,
    allowsOverflow: false,
    status: LocationStatus.OPEN,
    partNumberStart: "100000",
    partNumberEnd: "199999",
    travelSequence: 100,
    area: {
      name: "Backstock Area 2",
      areaType: AreaType.BACKSTOCK,
      sortOrder: 11,
    },
    homeSku: null,
    currentPallet: null,
    ...overrides,
  };
}

function classify(overrides: Record<string, unknown>, recommendedLocationIds = new Set<string>(), hasOpenNamedBackstock = true) {
  return classifyMoveDestination({
    location: location(overrides),
    pallet,
    recommendedLocationIds,
    hasOpenNamedBackstock,
  });
}

const wrongFrontHome = classify({
  isFrontHomeSlot: true,
  homeSkuId: "other-sku",
  area: {
    name: "Front Home Slots",
    areaType: AreaType.FRONT_HOME,
    sortOrder: 1,
  },
});
assert.equal(wrongFrontHome.category, "invalid");
assert.match(wrongFrontHome.reasons.join(" "), /Front home slots/);

const occupied = classify({
  currentPallet: {
    id: "other-pallet",
    palletLicensePlate: "PLT-OCCUPIED",
  },
});
assert.equal(occupied.category, "occupied");
assert.match(occupied.reasons.join(" "), /Occupied by pallet/);

const recommendedBackstock = classify({ id: "recommended-backstock" }, new Set(["recommended-backstock"]));
assert.equal(recommendedBackstock.category, "recommended");
assert.match(recommendedBackstock.reasons.join(" "), /Named backstock/);

const overflowBlockedByBackstock = classify({
  id: "overflow-1",
  fullLocationCode: "OVERFLOW-TEMP-001-L1-D1",
  allowsOverflow: true,
  isFlexSlot: true,
  area: {
    name: "Temporary Overflow",
    areaType: AreaType.OVERFLOW,
    sortOrder: 99,
  },
});
assert.equal(overflowBlockedByBackstock.category, "invalid");
assert.match(overflowBlockedByBackstock.reasons.join(" "), /reserved until named backstock/);

const overflowAllowedWhenBackstockFull = classify(
  {
    id: "overflow-2",
    fullLocationCode: "OVERFLOW-TEMP-001-L1-D1",
    allowsOverflow: true,
    isFlexSlot: true,
    area: {
      name: "Temporary Overflow",
      areaType: AreaType.OVERFLOW,
      sortOrder: 99,
    },
  },
  new Set(),
  false,
);
assert.equal(overflowAllowedWhenBackstockFull.category, "allowed");
assert.match(overflowAllowedWhenBackstockFull.reasons.join(" "), /no named backstock/);

const wrongPartNeighborhood = classify({
  homeSkuId: "other-sku",
  isFlexSlot: true,
  allowsOverflow: true,
  partNumberStart: "200000",
  partNumberEnd: "299999",
});
assert.equal(wrongPartNeighborhood.category, "invalid");
assert.match(wrongPartNeighborhood.reasons.join(" "), /part-number neighborhood/);

console.log("move destination classification tests passed");
