import { type ErrorRequestHandler, type RequestHandler, Router } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "./httpError.js";
import { prisma } from "./prisma.js";
import { getInboundPlacementSuggestions } from "./services/inboundSuggestionService.js";
import { getMoveDestinations } from "./services/moveDestinationService.js";
import { movePallet } from "./services/moveService.js";
import {
  inboundSuggestionQuerySchema,
  listLocationsQuerySchema,
  listPalletsQuerySchema,
  listSkusQuerySchema,
  moveDestinationsQuerySchema,
  moveHistoryQuerySchema,
  movePalletSchema,
  skuSearchQuerySchema,
} from "./validation.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.get("/locations", async (req, res, next) => {
  try {
    const query = listLocationsQuerySchema.parse(req.query);

    const locations = await prisma.location.findMany({
      where: {
        zone: query.zone,
        aisle: query.aisle,
        status: query.status,
        area: query.areaType ? { areaType: query.areaType } : undefined,
      },
      include: {
        area: true,
        homeSku: true,
        currentPallet: query.includePallets
          ? {
              include: {
                sku: true,
              },
            }
          : false,
      },
      orderBy: [
        { zone: "asc" },
        { aisle: "asc" },
        { bay: "asc" },
        { level: "asc" },
        { depthPosition: "asc" },
      ],
    });

    res.json({ locations });
  } catch (error) {
    next(error);
  }
});

router.get("/pallets", async (req, res, next) => {
  try {
    const query = listPalletsQuerySchema.parse(req.query);

    const pallets = await prisma.pallet.findMany({
      where: {
        skuId: query.skuId,
        currentLocationId: query.locationId,
        status: query.status ?? (query.includeConsumed ? undefined : { not: "CONSUMED" }),
      },
      include: {
        sku: true,
        currentLocation: {
          include: {
            area: true,
            homeSku: true,
          },
        },
        inboundReceipt: true,
      },
      orderBy: {
        palletLicensePlate: "asc",
      },
    });

    res.json({ pallets });
  } catch (error) {
    next(error);
  }
});

router.get("/pallets/:id", async (req, res, next) => {
  try {
    const pallet = await prisma.pallet.findUnique({
      where: { id: req.params.id },
      include: {
        sku: true,
        currentLocation: {
          include: {
            area: true,
            homeSku: true,
          },
        },
        inboundReceipt: true,
        moves: {
          include: {
            fromLocation: true,
            toLocation: true,
          },
          orderBy: {
            movedAt: "desc",
          },
        },
      },
    });

    if (!pallet) {
      throw new HttpError(404, "Pallet not found");
    }

    res.json({ pallet });
  } catch (error) {
    next(error);
  }
});

router.get("/skus", async (req, res, next) => {
  try {
    const query = listSkusQuerySchema.parse(req.query);

    const skus = await prisma.sku.findMany({
      where: {
        active: query.active,
        velocityClass: query.velocityClass,
        productFamily: query.productFamily,
      },
      include: {
        homeLocations: {
          include: {
            area: true,
          },
          orderBy: {
            fullLocationCode: "asc",
          },
        },
      },
      orderBy: {
        partNumber: "asc",
      },
      take: query.limit,
    });

    res.json({ skus });
  } catch (error) {
    next(error);
  }
});

router.get("/skus/search", async (req, res, next) => {
  try {
    const query = skuSearchQuerySchema.parse(req.query);

    const skus = await prisma.sku.findMany({
      where: {
        active: true,
        OR: [
          { partNumber: { contains: query.q, mode: "insensitive" } },
          { description: { contains: query.q, mode: "insensitive" } },
          { productFamily: { contains: query.q, mode: "insensitive" } },
        ],
      },
      include: {
        homeLocations: {
          include: {
            area: true,
            currentPallet: true,
          },
        },
        pallets: {
          include: {
            currentLocation: {
              include: {
                area: true,
              },
            },
          },
          orderBy: {
            palletLicensePlate: "asc",
          },
        },
      },
      orderBy: {
        partNumber: "asc",
      },
      take: 25,
    });

    res.json({ skus });
  } catch (error) {
    next(error);
  }
});

router.get("/skus/:id", async (req, res, next) => {
  try {
    const sku = await prisma.sku.findUnique({
      where: { id: req.params.id },
      include: {
        homeLocations: {
          include: {
            area: true,
            currentPallet: true,
          },
        },
        pallets: {
          include: {
            currentLocation: {
              include: {
                area: true,
              },
            },
          },
          orderBy: {
            palletLicensePlate: "asc",
          },
        },
      },
    });

    if (!sku) {
      throw new HttpError(404, "SKU not found");
    }

    res.json({ sku });
  } catch (error) {
    next(error);
  }
});

router.post("/moves", async (req, res, next) => {
  try {
    const body = movePalletSchema.parse(req.body);
    const result = await movePallet(prisma, body);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/moves", async (req, res, next) => {
  try {
    const query = moveHistoryQuerySchema.parse(req.query);

    const locationFilter = query.locationId
      ? {
          OR: [
            { fromLocationId: query.locationId },
            { toLocationId: query.locationId },
          ],
        }
      : {};

    const moves = await prisma.moveTransaction.findMany({
      where: {
        palletId: query.palletId,
        skuId: query.skuId,
        ...locationFilter,
      },
      include: {
        pallet: true,
        sku: true,
        fromLocation: true,
        toLocation: true,
      },
      orderBy: {
        movedAt: "desc",
      },
      take: query.limit,
    });

    res.json({ moves });
  } catch (error) {
    next(error);
  }
});

router.get("/move-destinations", async (req, res, next) => {
  try {
    const query = moveDestinationsQuerySchema.parse(req.query);
    const result = await getMoveDestinations(prisma, query.palletId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

const inboundPlacementSuggestionsHandler: RequestHandler = async (req, res, next) => {
  try {
    const query = inboundSuggestionQuerySchema.parse(req.query);
    const suggestions = await getInboundPlacementSuggestions(prisma, query);

    res.json(suggestions);
  } catch (error) {
    next(error);
  }
};

router.get("/suggestions/inbound-placement", inboundPlacementSuggestionsHandler);
router.get("/inbound-placement-suggestions", inboundPlacementSuggestionsHandler);

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    res.status(409).json({
      error: "Database constraint failed",
      details: error.message,
    });
    return;
  }

  if (error && typeof error === "object" && "issues" in error) {
    res.status(400).json({
      error: "Invalid request",
      details: error,
    });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
};
