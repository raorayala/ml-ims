#!/usr/bin/env node
/**
 * Agentic AI execution loop for ML-IMS.
 * Parses natural language, selects an MCP-equivalent tool, executes reorder logic.
 *
 * Usage:
 *   npm run start -w @ml-ims/agent -- "I took 50mL of Lot 902 for Project EXP-101"
 *   npm run start -w @ml-ims/agent   # interactive REPL
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import { runAgentLoop } from "@ml-ims/core";
import { AppError } from "@ml-ims/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function executeOnce(message: string, userId?: string) {
  const result = await runAgentLoop({ message, userId });
  console.log(JSON.stringify(result, null, 2));
}

async function repl() {
  const rl = readline.createInterface({ input, output });
  console.log("ML-IMS Agent (type 'exit' to quit)");
  console.log('Example: I took 50mL of Lot 902 for Project EXP-101');

  while (true) {
    const line = (await rl.question("\nlab> ")).trim();
    if (!line) continue;
    if (["exit", "quit", "q"].includes(line.toLowerCase())) break;
    try {
      await executeOnce(line);
    } catch (err) {
      if (err instanceof AppError) {
        console.error(`Error [${err.code}]: ${err.message}`);
      } else {
        console.error(err);
      }
    }
  }
  rl.close();
}

const args = process.argv.slice(2).join(" ").trim();
if (args) {
  executeOnce(args).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
} else {
  repl().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
