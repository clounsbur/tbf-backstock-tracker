import { type MoveReasonCode, type PrismaClient } from "@prisma/client";
import { HttpError } from "../httpError.js";
import { occupiedStatusForLocation, openStatusForLocation } from "./locationStatus.js";
import { validateLegalMove } from "./ruleValidationService.js";

type MovePalletInput = {
  palletId?: string;
  palletLicensePlate?: string;
  toLocationId?: string;
  toLocationCode?: string;
  movedBy: string;
  reasonCode: MoveReasonCode;
  notes?: string;
};

export async function movePallet(prisma: PrismaClient, input: MovePalletInput) {
  return prisma.$transaction(async (tx) => {
    const pallet = await tx.pallet.findFirst({
      where: input.palletId
        ? { id: input.palletId }
        : { palletLicensePlate: input.palletLicensePlate },
      include: {
        sku: true,
        currentLocation: true,
      },
    });

    if (!pallet) {
      throw new HttpError(404, "Pallet not found");
    }

    const destination = await tx.location.findFirst({
      where: input.toLocationId
        ? { id: input.toLocationId }
        : { fullLocationCode: input.toLocationCode },
      include: {
        currentPallet: true,
        homeSku: true,
        area: true,
      },
    });

    if (!destination) {
      throw new HttpError(404, "Destination location not found");
    }

    validateLegalMove(pallet.sku, destination);

    const fromLocationId = pallet.currentLocationId;
    const toLocationId = destination.id;

    if (fromLocationId === toLocationId) {
      throw new HttpError(409, "Pallet is already in that location");
    }

    const [updatedPallet, move] = await Promise.all([
      tx.pallet.update({
        where: { id: pallet.id },
        data: {
          currentLocationId: toLocationId,
          status: "AVAILABLE",
        },
        include: {
          sku: true,
          currentLocation: {
            include: {
              area: true,
              homeSku: true,
            },
          },
        },
      }),
      tx.moveTransaction.create({
        data: {
          palletId: pallet.id,
          skuId: pallet.skuId,
          fromLocationId,
          toLocationId,
          movedBy: input.movedBy,
          reasonCode: input.reasonCode,
          notes: input.notes,
        },
      }),
    ]);

    await tx.location.update({
      where: { id: destination.id },
      data: {
        status: occupiedStatusForLocation(destination, pallet.skuId),
      },
    });

    if (pallet.currentLocation) {
      await tx.location.update({
        where: { id: pallet.currentLocation.id },
        data: {
          status: openStatusForLocation(pallet.currentLocation),
        },
      });
    }

    return { pallet: updatedPallet, move };
  });
}
