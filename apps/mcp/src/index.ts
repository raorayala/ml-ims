#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  checkInReagent,
  checkOutReagent,
  evaluateThresholds,
  generateDraftPo,
  getConsumptionReport,
} from "@ml-ims/core";
import { CheckInInput, CheckOutInput } from "@ml-ims/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

const server = new McpServer({
  name: "ml-ims",
  version: "1.0.0",
});

server.tool(
  "check_out_reagent",
  "Check out quantity from an Active inventory lot. Validates stock, writes an immutable audit transaction, recalculates stock, and auto-generates a Draft PO when below threshold.",
  {
    lotId: z.string().uuid().optional().describe("Lot UUID if known"),
    lotNumber: z.string().optional().describe("Human lot number, e.g. 902"),
    reagentName: z.string().optional().describe("Optional reagent name to disambiguate lot numbers"),
    quantity: z.number().positive().describe("Quantity to remove"),
    userId: z.string().describe("Acting lab user id"),
    experimentIdOrProject: z.string().optional().describe("Experiment or project code"),
    notes: z.string().optional(),
  },
  async (args) => {
    try {
      const input = CheckOutInput.parse(args);
      return jsonResult(await checkOutReagent(input));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.tool(
  "check_in_reagent",
  "Check in / return quantity to a lot and append an immutable audit ledger entry.",
  {
    lotId: z.string().uuid().optional(),
    lotNumber: z.string().optional(),
    quantity: z.number().positive(),
    userId: z.string(),
    experimentIdOrProject: z.string().optional(),
    notes: z.string().optional(),
  },
  async (args) => {
    try {
      const input = CheckInInput.parse(args);
      return jsonResult(await checkInReagent(input));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.tool(
  "evaluate_thresholds",
  "Scan all reagents and create Draft purchase orders / low-stock alerts where total Active stock is at or below min_threshold_quantity.",
  {},
  async () => {
    try {
      return jsonResult(await evaluateThresholds());
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.tool(
  "generate_draft_po",
  "Force evaluation of reorder logic for a reagent and generate a Draft PO if none is open. Uses max(standard_reorder_quantity, avg_monthly_consumption * 1.5 - current_stock).",
  {
    reagentId: z.string().uuid().describe("Reagent UUID"),
  },
  async ({ reagentId }) => {
    try {
      return jsonResult(await generateDraftPo(reagentId));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.tool(
  "get_consumption_report",
  "Return rolling 30/60/90-day consumption trends grouped by project or reagent.",
  {
    days: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(30),
    groupBy: z.enum(["project", "reagent"]).default("project"),
  },
  async ({ days, groupBy }) => {
    try {
      return jsonResult(await getConsumptionReport(days, groupBy));
    } catch (err) {
      return errorResult(err);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ML-IMS MCP server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
