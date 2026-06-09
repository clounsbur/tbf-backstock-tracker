import { type MoveReasonCode } from "../domainTypes.js";
import { HttpError } from "../httpError.js";
import { type InventorySupabaseClient } from "../supabase.js";
import { mapPallet, PRODUCT_SELECT } from "./supabaseMappers.js";

type MovePalletInput = {
  palletId?: string;
  palletLicensePlate?: string;
  toLocationId?: string;
  toLocationCode?: string;
  movedBy: string;
  reasonCode: MoveReasonCode;
  notes?: string;
};

export async function movePallet(supabase: InventorySupabaseClient, input: MovePalletInput) {
  const { data, error } = await supabase.rpc("move_pallet", {
    input: {
      pallet_id: input.palletId ?? null,
      pallet_license_plate: input.palletLicensePlate ?? null,
      to_location_id: input.toLocationId ?? null,
      to_location_code: input.toLocationCode ?? null,
      moved_by: input.movedBy,
      reason_code: input.reasonCode,
      notes: input.notes ?? null,
    },
  });

  if (error) {
    throw new HttpError(409, error.message, error);
  }

  const palletId = data?.palletId as string | undefined;
  const moveId = data?.moveId as string | undefined;

  if (!palletId || !moveId) {
    throw new HttpError(500, "Move RPC did not return pallet and move ids", data);
  }

  const [pallet, move] = await Promise.all([fetchPallet(supabase, palletId), fetchMove(supabase, moveId)]);

  return { pallet, move };
}

async function fetchPallet(supabase: InventorySupabaseClient, palletId: string) {
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
        )
      `,
    )
    .eq("id", palletId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "Pallet not found after move");
  }

  return mapPallet(data);
}

async function fetchMove(supabase: InventorySupabaseClient, moveId: string) {
  const { data, error } = await supabase
    .from("move_transactions")
    .select(
      `
        *,
        pallet:pallets(*),
        product:products!move_transactions_product_id_fkey(${PRODUCT_SELECT}),
        from_location:locations!move_transactions_from_location_id_fkey(*),
        to_location:locations!move_transactions_to_location_id_fkey(*)
      `,
    )
    .eq("id", moveId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "Move not found after move");
  }

  return {
    id: data.id,
    palletId: data.pallet_id,
    skuId: data.product_id,
    fromLocationId: data.from_location_id ?? null,
    toLocationId: data.to_location_id ?? null,
    movedBy: data.moved_by,
    movedAt: data.moved_at,
    reasonCode: data.reason_code,
    notes: data.notes ?? null,
    pallet: data.pallet
      ? {
          id: data.pallet.id,
          palletLicensePlate: data.pallet.pallet_license_plate,
        }
      : undefined,
    sku: data.product
      ? {
          id: data.product.id,
          partNumber: data.product.item_code,
          description: data.product.description,
          velocityClass: data.product.velocity_class,
        }
      : undefined,
    fromLocation: data.from_location
      ? {
          id: data.from_location.id,
          fullLocationCode: data.from_location.full_location_code,
        }
      : null,
    toLocation: data.to_location
      ? {
          id: data.to_location.id,
          fullLocationCode: data.to_location.full_location_code,
        }
      : null,
  };
}
