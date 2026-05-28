import "dotenv/config";
import { strict as assert } from "node:assert";
import type { AddressInfo } from "node:net";
import { app } from "./app.js";
import { prisma } from "./prisma.js";

if (!process.env.DATABASE_URL) {
  console.log("move destinations endpoint test skipped: DATABASE_URL is not set");
  process.exit(0);
}

const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
  const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
});

try {
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const palletsResponse = await fetch(`${baseUrl}/pallets`);
  assert.equal(palletsResponse.ok, true);

  const palletsBody = (await palletsResponse.json()) as {
    pallets: Array<{ id: string; palletLicensePlate: string }>;
  };
  assert.ok(palletsBody.pallets.length > 0);

  const pallet = palletsBody.pallets.find((item) => item.palletLicensePlate === "PLT-100100-002") ?? palletsBody.pallets[0];
  const destinationsResponse = await fetch(`${baseUrl}/move-destinations?palletId=${encodeURIComponent(pallet.id)}`);
  assert.equal(destinationsResponse.ok, true);

  const destinationsBody = (await destinationsResponse.json()) as {
    pallet: { id: string; palletLicensePlate: string };
    destinations: Array<{ category: string; reasons: string[]; location: { fullLocationCode: string } }>;
    summary: Record<string, number>;
  };

  assert.equal(destinationsBody.pallet.id, pallet.id);
  assert.ok(destinationsBody.destinations.length > 0);
  assert.ok(destinationsBody.destinations.every((destination) => Array.isArray(destination.reasons)));
  assert.ok(Object.hasOwn(destinationsBody.summary, "recommended"));
  assert.ok(Object.hasOwn(destinationsBody.summary, "allowed"));
  assert.ok(Object.hasOwn(destinationsBody.summary, "occupied"));
  assert.ok(Object.hasOwn(destinationsBody.summary, "invalid"));

  console.log("move destinations endpoint test passed");
} finally {
  server.close();
  await prisma.$disconnect();
}
