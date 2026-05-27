import { z } from "zod";

export const listLocationsQuerySchema = z.object({
  zone: z.string().optional(),
  aisle: z.string().optional(),
  areaType: z.enum(["FRONT_HOME", "BACKSTOCK", "FLEX_RESERVE", "OVERFLOW", "RECEIVING"]).optional(),
  status: z
    .enum(["OPEN", "OCCUPIED_HOME_SKU", "OCCUPIED_OVERFLOW_SKU", "RESERVED_HOME_SLOT", "OPEN_FLEX_SLOT", "BLOCKED"])
    .optional(),
  includePallets: z.coerce.boolean().optional().default(true),
});

export const listPalletsQuerySchema = z.object({
  skuId: z.string().optional(),
  locationId: z.string().optional(),
  status: z.enum(["AVAILABLE", "IN_TRANSIT", "CONSUMED", "HOLD"]).optional(),
  includeConsumed: z.coerce.boolean().optional().default(false),
});

export const listSkusQuerySchema = z.object({
  active: z.coerce.boolean().optional(),
  velocityClass: z.enum(["FAST", "MEDIUM", "SLOW"]).optional(),
  productFamily: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const skuSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "Search query is required"),
});

export const movePalletSchema = z.object({
  palletId: z.string().trim().min(1).optional(),
  palletLicensePlate: z.string().trim().min(1).optional(),
  toLocationId: z.string().trim().min(1).optional(),
  toLocationCode: z.string().trim().min(1).optional(),
  movedBy: z.string().trim().min(1),
  reasonCode: z
    .enum(["STANDARD_MOVE", "INBOUND_PUTAWAY", "OVERFLOW_RELOCATION", "RECLAIM_HOME_SLOT", "CONSOLIDATION", "ADJUSTMENT"])
    .default("STANDARD_MOVE"),
  notes: z.string().trim().max(1000).optional(),
}).refine((value) => value.palletId || value.palletLicensePlate, {
  message: "Provide palletId or palletLicensePlate",
  path: ["palletId"],
}).refine((value) => value.toLocationId || value.toLocationCode, {
  message: "Provide toLocationId or toLocationCode",
  path: ["toLocationId"],
});

export const moveHistoryQuerySchema = z.object({
  palletId: z.string().optional(),
  skuId: z.string().optional(),
  locationId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const inboundSuggestionQuerySchema = z.object({
  skuId: z.string().trim().min(1).optional(),
  partNumber: z.string().trim().min(1).optional(),
  inboundReceiptId: z.string().trim().min(1).optional(),
  palletQty: z.coerce.number().int().min(1).optional().default(1),
}).refine((value) => value.skuId || value.partNumber || value.inboundReceiptId, {
  message: "Provide skuId, partNumber, or inboundReceiptId",
  path: ["skuId"],
});
