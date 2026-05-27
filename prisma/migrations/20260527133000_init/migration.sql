-- CreateEnum
CREATE TYPE "VelocityClass" AS ENUM ('FAST', 'MEDIUM', 'SLOW');

-- CreateEnum
CREATE TYPE "AreaType" AS ENUM ('FRONT_HOME', 'BACKSTOCK', 'FLEX_RESERVE', 'OVERFLOW', 'RECEIVING');

-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('OPEN', 'OCCUPIED_HOME_SKU', 'OCCUPIED_OVERFLOW_SKU', 'RESERVED_HOME_SLOT', 'OPEN_FLEX_SLOT', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PalletStatus" AS ENUM ('AVAILABLE', 'IN_TRANSIT', 'CONSUMED', 'HOLD');

-- CreateEnum
CREATE TYPE "MoveReasonCode" AS ENUM ('STANDARD_MOVE', 'INBOUND_PUTAWAY', 'OVERFLOW_RELOCATION', 'RECLAIM_HOME_SLOT', 'CONSOLIDATION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InboundReceiptStatus" AS ENUM ('OPEN', 'PARTIALLY_PLACED', 'PLACED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "velocityClass" "VelocityClass" NOT NULL,
    "productFamily" TEXT,
    "palletsPerFullAllocation" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lotNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaType" "AreaType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "aisle" TEXT NOT NULL,
    "bay" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "depthPosition" INTEGER NOT NULL,
    "fullLocationCode" TEXT NOT NULL,
    "homeSkuId" TEXT,
    "isFrontHomeSlot" BOOLEAN NOT NULL DEFAULT false,
    "isFlexSlot" BOOLEAN NOT NULL DEFAULT false,
    "allowsOverflow" BOOLEAN NOT NULL DEFAULT false,
    "status" "LocationStatus" NOT NULL DEFAULT 'OPEN',
    "partNumberStart" TEXT,
    "partNumberEnd" TEXT,
    "travelSequence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pallet" (
    "id" TEXT NOT NULL,
    "palletLicensePlate" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "currentLocationId" TEXT,
    "status" "PalletStatus" NOT NULL DEFAULT 'AVAILABLE',
    "inboundReceiptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoveTransaction" (
    "id" TEXT NOT NULL,
    "palletId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "movedBy" TEXT NOT NULL,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reasonCode" "MoveReasonCode" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "MoveTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundReceipt" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "palletQty" INTEGER NOT NULL,
    "receivedBy" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "InboundReceiptStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sku_partNumber_key" ON "Sku"("partNumber");

-- CreateIndex
CREATE INDEX "Sku_velocityClass_idx" ON "Sku"("velocityClass");

-- CreateIndex
CREATE INDEX "Sku_productFamily_idx" ON "Sku"("productFamily");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseArea_name_key" ON "WarehouseArea"("name");

-- CreateIndex
CREATE INDEX "WarehouseArea_areaType_idx" ON "WarehouseArea"("areaType");

-- CreateIndex
CREATE UNIQUE INDEX "Location_fullLocationCode_key" ON "Location"("fullLocationCode");

-- CreateIndex
CREATE INDEX "Location_areaId_idx" ON "Location"("areaId");

-- CreateIndex
CREATE INDEX "Location_zone_aisle_bay_idx" ON "Location"("zone", "aisle", "bay");

-- CreateIndex
CREATE INDEX "Location_homeSkuId_idx" ON "Location"("homeSkuId");

-- CreateIndex
CREATE INDEX "Location_status_idx" ON "Location"("status");

-- CreateIndex
CREATE INDEX "Location_isFrontHomeSlot_isFlexSlot_allowsOverflow_idx" ON "Location"("isFrontHomeSlot", "isFlexSlot", "allowsOverflow");

-- CreateIndex
CREATE UNIQUE INDEX "Pallet_palletLicensePlate_key" ON "Pallet"("palletLicensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "Pallet_currentLocationId_key" ON "Pallet"("currentLocationId");

-- CreateIndex
CREATE INDEX "Pallet_skuId_idx" ON "Pallet"("skuId");

-- CreateIndex
CREATE INDEX "Pallet_currentLocationId_idx" ON "Pallet"("currentLocationId");

-- CreateIndex
CREATE INDEX "Pallet_status_idx" ON "Pallet"("status");

-- CreateIndex
CREATE INDEX "MoveTransaction_palletId_idx" ON "MoveTransaction"("palletId");

-- CreateIndex
CREATE INDEX "MoveTransaction_skuId_idx" ON "MoveTransaction"("skuId");

-- CreateIndex
CREATE INDEX "MoveTransaction_movedAt_idx" ON "MoveTransaction"("movedAt");

-- CreateIndex
CREATE INDEX "MoveTransaction_fromLocationId_idx" ON "MoveTransaction"("fromLocationId");

-- CreateIndex
CREATE INDEX "MoveTransaction_toLocationId_idx" ON "MoveTransaction"("toLocationId");

-- CreateIndex
CREATE INDEX "InboundReceipt_skuId_idx" ON "InboundReceipt"("skuId");

-- CreateIndex
CREATE INDEX "InboundReceipt_status_idx" ON "InboundReceipt"("status");

-- CreateIndex
CREATE INDEX "InboundReceipt_receivedAt_idx" ON "InboundReceipt"("receivedAt");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "WarehouseArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_homeSkuId_fkey" FOREIGN KEY ("homeSkuId") REFERENCES "Sku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pallet" ADD CONSTRAINT "Pallet_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pallet" ADD CONSTRAINT "Pallet_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pallet" ADD CONSTRAINT "Pallet_inboundReceiptId_fkey" FOREIGN KEY ("inboundReceiptId") REFERENCES "InboundReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveTransaction" ADD CONSTRAINT "MoveTransaction_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "Pallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveTransaction" ADD CONSTRAINT "MoveTransaction_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveTransaction" ADD CONSTRAINT "MoveTransaction_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveTransaction" ADD CONSTRAINT "MoveTransaction_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundReceipt" ADD CONSTRAINT "InboundReceipt_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
