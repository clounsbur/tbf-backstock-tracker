import "dotenv/config";
import cors from "cors";
import express from "express";
import { prisma } from "./prisma.js";
import { errorHandler, router } from "./routes.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());
app.use("/api", router);
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Warehouse inventory API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
