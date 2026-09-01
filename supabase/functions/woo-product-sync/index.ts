// Receives WooCommerce "product created/updated" webhooks and keeps this
// app's own `products` table current -- independent of the Bear Factory
// mobile app's sync (which lives in a different codebase/database and only
// pulls products in on a manual trigger). Only identity/description sync
// from WooCommerce; inventory-only fields (velocity_class, product_family,
// pallets_per_full_allocation, lot_number, barcode) are managed inside this
// app and are never touched here.
//
// WooCommerce webhook setup (Settings -> Advanced -> Webhooks in WP admin):
//   Topic:      Product updated  (add a second webhook for Product created)
//   Delivery:   https://<project-ref>.supabase.co/functions/v1/woo-product-sync
//   Secret:     the value of the WC_WEBHOOK_SECRET function secret (below)
//
// WooCommerce signs the request body with HMAC-SHA256 using that secret and
// sends the base64 digest in the X-WC-Webhook-Signature header -- verified
// below before touching the database.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WC_WEBHOOK_SECRET = Deno.env.get("WC_WEBHOOK_SECRET");

interface WcProduct {
  sku: string;
  name: string;
  status: string;
}

async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!WC_WEBHOOK_SECRET) return false;
  if (!signatureHeader) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WC_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return expected === signatureHeader;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // WooCommerce sends an empty ping payload when a webhook is first created --
  // acknowledge it without requiring a signature so the webhook can activate.
  if (!rawBody) {
    return new Response("ok", { status: 200 });
  }

  const signatureOk = await verifySignature(rawBody, req.headers.get("x-wc-webhook-signature"));
  if (!signatureOk) {
    return new Response("Invalid signature", { status: 401 });
  }

  let product: WcProduct;
  try {
    product = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const itemCode = product.sku?.trim();
  if (!itemCode) {
    // Products with no SKU can't be matched to anything this app tracks.
    return new Response("ok (no sku, skipped)", { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("item_code", itemCode)
    .maybeSingle();

  const isPickable = product.status === "publish";

  if (existing) {
    const { error } = await supabase
      .from("products")
      .update({ description: product.name, is_pickable: isPickable })
      .eq("id", existing.id);
    if (error) return new Response(`Update failed: ${error.message}`, { status: 500 });
    return new Response("ok (updated)", { status: 200 });
  }

  const { error } = await supabase
    .from("products")
    .insert({ item_code: itemCode, description: product.name, is_pickable: isPickable });
  if (error) return new Response(`Insert failed: ${error.message}`, { status: 500 });
  return new Response("ok (inserted)", { status: 200 });
});
