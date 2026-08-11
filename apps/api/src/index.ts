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
const defaultCorsOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const corsOrigins = Array.from(
  new Set([
    ...defaultCorsOrigins,
    ...(process.env.CORS_ORIGIN ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ]),
);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (no Origin) and configured frontends.
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
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
