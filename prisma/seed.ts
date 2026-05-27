import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const backstockAreas = [
  "Backstock Area 1",
  "Backstock Area 2",
  "Backstock Area 3",
  "Backstock Area 4",
  "Backstock Area 5",
  "Backstock Area 6",
  "Backstock Area 7",
];

async function upsertArea(name: string, areaType: "FRONT_HOME" | "BACKSTOCK" | "FLEX_RESERVE" | "OVERFLOW" | "RECEIVING", sortOrder: number) {
  return prisma.warehouseArea.upsert({
    where: { name },
    update: { areaType, sortOrder, active: true },
    create: { name, areaType, sortOrder },
  });
}

async function main() {
  const frontArea = await upsertArea("Front Home Slots", "FRONT_HOME", 1);
  const flexArea = await upsertArea("Flex Reserve Slots", "FLEX_RESERVE", 2);
  const overflowArea = await upsertArea("Temporary Overflow", "OVERFLOW", 3);
  const receivingArea = await upsertArea("Receiving Dock", "RECEIVING", 4);

  const seededBackstockAreas = await Promise.all(
    backstockAreas.map((name, index) => upsertArea(name, "BACKSTOCK", 10 + index)),
  );

  const skus = await Promise.all([
    prisma.sku.upsert({
      where: { partNumber: "100100" },
      update: {},
      create: {
        partNumber: "100100",
        description: "Widget housing assembly",
        velocityClass: "FAST",
        productFamily: "Widget",
        palletsPerFullAllocation: 4,
        lotNumber: "LOT-A",
      },
    }),
    prisma.sku.upsert({
      where: { partNumber: "100220" },
      update: {},
      create: {
        partNumber: "100220",
        description: "Widget bearing kit",
        velocityClass: "MEDIUM",
        productFamily: "Widget",
        palletsPerFullAllocation: 2,
        lotNumber: "LOT-B",
      },
    }),
    prisma.sku.upsert({
      where: { partNumber: "200050" },
      update: {},
      create: {
        partNumber: "200050",
        description: "Valve service pack",
        velocityClass: "SLOW",
        productFamily: "Valve",
        palletsPerFullAllocation: 1,
        lotNumber: "LOT-C",
      },
    }),
  ]);

  const [fastSku, mediumSku, slowSku] = skus;

  const locations = [
    {
      areaId: frontArea.id,
      zone: "FRONT",
      aisle: "A01",
      bay: "001",
      level: "L1",
      depthPosition: 1,
      fullLocationCode: "FRONT-A01-001-L1-D1",
      homeSkuId: fastSku.id,
      isFrontHomeSlot: true,
      isFlexSlot: false,
      allowsOverflow: false,
      status: "OCCUPIED_HOME_SKU" as const,
      partNumberStart: "100000",
      partNumberEnd: "100199",
      travelSequence: 101,
    },
    {
      areaId: frontArea.id,
      zone: "FRONT",
      aisle: "A01",
      bay: "002",
      level: "L1",
      depthPosition: 1,
      fullLocationCode: "FRONT-A01-002-L1-D1",
      homeSkuId: mediumSku.id,
      isFrontHomeSlot: true,
      isFlexSlot: false,
      allowsOverflow: false,
      status: "RESERVED_HOME_SLOT" as const,
      partNumberStart: "100200",
      partNumberEnd: "100299",
      travelSequence: 102,
    },
    {
      areaId: frontArea.id,
      zone: "FRONT",
      aisle: "A02",
      bay: "001",
      level: "L1",
      depthPosition: 1,
      fullLocationCode: "FRONT-A02-001-L1-D1",
      homeSkuId: slowSku.id,
      isFrontHomeSlot: true,
      isFlexSlot: false,
      allowsOverflow: false,
      status: "RESERVED_HOME_SLOT" as const,
      partNumberStart: "200000",
      partNumberEnd: "200099",
      travelSequence: 201,
    },
    {
      areaId: flexArea.id,
      zone: "FLEX",
      aisle: "A01",
      bay: "001",
      level: "L1",
      depthPosition: 2,
      fullLocationCode: "FLEX-A01-001-L1-D2",
      homeSkuId: fastSku.id,
      isFrontHomeSlot: false,
      isFlexSlot: true,
      allowsOverflow: true,
      status: "OCCUPIED_OVERFLOW_SKU" as const,
      partNumberStart: "100000",
      partNumberEnd: "100199",
      travelSequence: 111,
    },
    {
      areaId: flexArea.id,
      zone: "FLEX",
      aisle: "A01",
      bay: "002",
      level: "L1",
      depthPosition: 2,
      fullLocationCode: "FLEX-A01-002-L1-D2",
      homeSkuId: mediumSku.id,
      isFrontHomeSlot: false,
      isFlexSlot: true,
      allowsOverflow: true,
      status: "OPEN_FLEX_SLOT" as const,
      partNumberStart: "100200",
      partNumberEnd: "100299",
      travelSequence: 112,
    },
    {
      areaId: overflowArea.id,
      zone: "OVERFLOW",
      aisle: "TEMP",
      bay: "001",
      level: "L1",
      depthPosition: 1,
      fullLocationCode: "OVERFLOW-TEMP-001-L1-D1",
      homeSkuId: null,
      isFrontHomeSlot: false,
      isFlexSlot: true,
      allowsOverflow: true,
      status: "OPEN_FLEX_SLOT" as const,
      partNumberStart: null,
      partNumberEnd: null,
      travelSequence: 900,
    },
    {
      areaId: receivingArea.id,
      zone: "RECEIVING",
      aisle: "DOCK",
      bay: "001",
      level: "L1",
      depthPosition: 1,
      fullLocationCode: "RECEIVING-DOCK-001-L1-D1",
      homeSkuId: null,
      isFrontHomeSlot: false,
      isFlexSlot: false,
      allowsOverflow: false,
      status: "OPEN" as const,
      partNumberStart: null,
      partNumberEnd: null,
      travelSequence: 1,
    },
    ...seededBackstockAreas.map((area, index) => ({
      areaId: area.id,
      zone: `BACKSTOCK-${index + 1}`,
      aisle: `B${String(index + 1).padStart(2, "0")}`,
      bay: "001",
      level: "L1",
      depthPosition: 1,
      fullLocationCode: `BACKSTOCK-${index + 1}-B${String(index + 1).padStart(2, "0")}-001-L1-D1`,
      homeSkuId: null,
      isFrontHomeSlot: false,
      isFlexSlot: false,
      allowsOverflow: false,
      status: index === 0 ? ("OCCUPIED_HOME_SKU" as const) : ("OPEN" as const),
      partNumberStart: index < 4 ? "100000" : "200000",
      partNumberEnd: index < 4 ? "199999" : "299999",
      travelSequence: 300 + index,
    })),
  ];

  for (const location of locations) {
    await prisma.location.upsert({
      where: { fullLocationCode: location.fullLocationCode },
      update: location,
      create: location,
    });
  }

  const fastHomeLocation = await prisma.location.findUniqueOrThrow({
    where: { fullLocationCode: "FRONT-A01-001-L1-D1" },
  });
  const fastBackstockLocation = await prisma.location.findUniqueOrThrow({
    where: { fullLocationCode: "BACKSTOCK-1-B01-001-L1-D1" },
  });
  const flexBorrowedLocation = await prisma.location.findUniqueOrThrow({
    where: { fullLocationCode: "FLEX-A01-001-L1-D2" },
  });

  const inboundReceipt = await prisma.inboundReceipt.upsert({
    where: { id: "demo-inbound-100220" },
    update: {
      status: "OPEN",
      palletQty: 2,
      receivedBy: "receiving.demo",
    },
    create: {
      id: "demo-inbound-100220",
      skuId: mediumSku.id,
      palletQty: 2,
      receivedBy: "receiving.demo",
      status: "OPEN",
      notes: "Demo inbound receipt waiting for placement suggestions.",
    },
  });

  const pallets = [
    {
      palletLicensePlate: "PLT-100100-001",
      skuId: fastSku.id,
      quantity: 120,
      currentLocationId: fastHomeLocation.id,
      receivedAt: new Date("2026-05-20T09:00:00.000Z"),
    },
    {
      palletLicensePlate: "PLT-100100-002",
      skuId: fastSku.id,
      quantity: 120,
      currentLocationId: fastBackstockLocation.id,
      receivedAt: new Date("2026-05-20T09:10:00.000Z"),
    },
    {
      palletLicensePlate: "PLT-200050-001",
      skuId: slowSku.id,
      quantity: 60,
      currentLocationId: flexBorrowedLocation.id,
      receivedAt: new Date("2026-05-21T11:30:00.000Z"),
    },
    {
      palletLicensePlate: "PLT-100220-INB-001",
      skuId: mediumSku.id,
      quantity: 90,
      currentLocationId: null,
      inboundReceiptId: inboundReceipt.id,
      receivedAt: new Date("2026-05-27T13:00:00.000Z"),
    },
  ];

  for (const pallet of pallets) {
    await prisma.pallet.upsert({
      where: { palletLicensePlate: pallet.palletLicensePlate },
      update: pallet,
      create: pallet,
    });
  }

  const movedPallet = await prisma.pallet.findUniqueOrThrow({
    where: { palletLicensePlate: "PLT-200050-001" },
  });

  await prisma.moveTransaction.upsert({
    where: { id: "demo-move-200050-001" },
    update: {
      palletId: movedPallet.id,
      skuId: slowSku.id,
      fromLocationId: null,
      toLocationId: flexBorrowedLocation.id,
      movedBy: "supervisor.demo",
      reasonCode: "INBOUND_PUTAWAY",
      notes: "Demo slow mover placed in a reversible flex reserve slot.",
    },
    create: {
      id: "demo-move-200050-001",
      palletId: movedPallet.id,
      skuId: slowSku.id,
      fromLocationId: null,
      toLocationId: flexBorrowedLocation.id,
      movedBy: "supervisor.demo",
      reasonCode: "INBOUND_PUTAWAY",
      notes: "Demo slow mover placed in a reversible flex reserve slot.",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
