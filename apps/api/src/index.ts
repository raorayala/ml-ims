import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { router } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { startExpirationCron } from "./services/expirationCron.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

app.use(
  cors({
    origin: corsOrigin.split(",").map((s) => s.trim()),
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);

app.use("/api", router);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`ML-IMS API listening on http://localhost:${port}`);
  startExpirationCron();
});
