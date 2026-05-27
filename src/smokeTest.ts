import "dotenv/config";
import { prisma } from "./prisma.js";
import { getInboundPlacementSuggestions } from "./services/inboundSuggestionService.js";
import { validateLegalMove } from "./services/ruleValidationService.js";

async function main() {
  await prisma.$connect();

  const backstockCount = await prisma.warehouseArea.count({
    where: { areaType: "BACKSTOCK", active: true },
  });

  if (backstockCount !== 7) {
    throw new Error(`Expected 7 active backstock areas, found ${backstockCount}`);
  }

  const demoSku = await prisma.sku.findUniqueOrThrow({
    where: { partNumber: "100220" },
  });

  const suggestions = await getInboundPlacementSuggestions(prisma, {
    skuId: demoSku.id,
    palletQty: 1,
  });

  if (suggestions.suggestions.length === 0) {
    throw new Error("Expected at least one inbound placement suggestion");
  }

  const firstSuggestion = suggestions.suggestions[0];
  if (firstSuggestion.location.areaType === "OVERFLOW") {
    throw new Error("Expected named backstock or home/flex space to rank before temporary overflow");
  }

  const wrongFrontHomeSlot = await prisma.location.findFirstOrThrow({
    where: {
      isFrontHomeSlot: true,
      homeSkuId: { not: demoSku.id },
    },
    include: {
      currentPallet: true,
      area: true,
    },
  });

  let rejectedIllegalFrontMove = false;
  try {
    validateLegalMove(demoSku, wrongFrontHomeSlot);
  } catch {
    rejectedIllegalFrontMove = true;
  }

  if (!rejectedIllegalFrontMove) {
    throw new Error("Expected front-home-slot validation to reject a non-home SKU");
  }

  console.log("Database smoke test passed");
  console.log(`Backstock areas: ${backstockCount}`);
  console.log(`Top suggestion for ${demoSku.partNumber}: ${firstSuggestion.location.fullLocationCode}`);
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
