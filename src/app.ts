import cors from "cors";
import express from "express";
import { errorHandler, router } from "./routes.js";

export const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", router);
app.use(errorHandler);
