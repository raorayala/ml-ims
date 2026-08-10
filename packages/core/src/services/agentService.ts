import {
  AgentRequestInput,
  AppError,
  CheckInInput,
  CheckOutInput,
} from "@ml-ims/shared";
import {
  checkInReagent,
  checkOutReagent,
  evaluateThresholds,
  generateDraftPo,
} from "./inventoryService.js";
import { getConsumptionReport } from "./reportingService.js";
import { prisma } from "@ml-ims/db";

export type AgentAction =
  | { tool: "check_out_reagent"; args: CheckOutInput }
  | { tool: "check_in_reagent"; args: CheckInInput }
  | { tool: "evaluate_thresholds"; args: Record<string, never> }
  | { tool: "generate_draft_po"; args: { reagentId: string } }
  | {
      tool: "get_consumption_report";
      args: { days: 30 | 60 | 90; groupBy: "project" | "reagent" };
    };

function parseQuantity(raw: string): number {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(`Invalid quantity: ${raw}`, 400, "INVALID_QUANTITY");
  }
  return n;
}

/**
 * Rule-based NL parser (always free / offline).
 * Handles phrases like:
 *  - "I took 50mL of Lot 902 for Project EXP-101"
 *  - "Check in 25 of lot ETH-881"
 *  - "Evaluate thresholds"
 *  - "Show 30 day consumption by project"
 */
export function parseNaturalLanguage(
  message: string,
  defaultUserId: string,
): AgentAction {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (
    /evaluate\s+thresholds?/.test(lower) ||
    /check\s+low\s*stock/.test(lower) ||
    /reorder\s+alerts?/.test(lower)
  ) {
    return { tool: "evaluate_thresholds", args: {} };
  }

  const consumption = lower.match(
    /(?:show|get|generate)?\s*(?:the\s+)?(\d+)\s*[- ]?day\s+consumption(?:\s+by\s+(project|reagent))?/,
  );
  if (consumption || /consumption\s+report/.test(lower)) {
    const daysRaw = consumption?.[1] ? Number(consumption[1]) : 30;
    const days = ([30, 60, 90] as const).includes(daysRaw as 30 | 60 | 90)
      ? (daysRaw as 30 | 60 | 90)
      : 30;
    const groupBy =
      (consumption?.[2] as "project" | "reagent" | undefined) ??
      (/by\s+reagent/.test(lower) ? "reagent" : "project");
    return {
      tool: "get_consumption_report",
      args: { days, groupBy },
    };
  }

  const draftPo = text.match(
    /(?:generate|create|draft)\s+(?:a\s+)?(?:purchase\s+order|po)\s+for\s+(.+)/i,
  );
  if (draftPo) {
    return {
      tool: "generate_draft_po",
      args: { reagentId: draftPo[1].trim() },
    };
  }

  const checkIn =
    text.match(
      /(?:check\s*[- ]?in|returned|return(?:ed)?)\s+(\d+(?:\.\d+)?)\s*(?:mL|L|g|kg|vials?|packs?)?\s*(?:of\s+)?(?:lot\s+)?([A-Za-z0-9-]+)/i,
    ) ||
    text.match(
      /(?:put\s+back|restock(?:ed)?)\s+(\d+(?:\.\d+)?)\s*(?:mL|L|g|kg|vials?|packs?)?\s*(?:of\s+)?(?:lot\s+)?([A-Za-z0-9-]+)/i,
    );

  if (checkIn) {
    return {
      tool: "check_in_reagent",
      args: CheckInInput.parse({
        lotNumber: checkIn[2],
        quantity: parseQuantity(checkIn[1]),
        userId: defaultUserId,
      }),
    };
  }

  const checkOut =
    text.match(
      /(?:took|take|used|use|check\s*[- ]?out|withdraw(?:n)?)\s+(\d+(?:\.\d+)?)\s*(?:mL|L|g|kg|vials?|packs?)?\s*(?:of\s+)?(?:lot\s+)?([A-Za-z0-9-]+)(?:\s+for\s+(?:project\s+|experiment\s+)?([A-Za-z0-9_-]+))?/i,
    ) ||
    text.match(
      /i\s+took\s+(\d+(?:\.\d+)?)\s*(?:mL|L|g|kg|vials?|packs?)?\s*(?:of\s+)?(?:lot\s+)?([A-Za-z0-9-]+)(?:\s+for\s+(?:project\s+|experiment\s+)?([A-Za-z0-9_-]+))?/i,
    );

  if (checkOut) {
    return {
      tool: "check_out_reagent",
      args: CheckOutInput.parse({
        lotNumber: checkOut[2],
        quantity: parseQuantity(checkOut[1]),
        userId: defaultUserId,
        experimentIdOrProject: checkOut[3],
      }),
    };
  }

  throw new AppError(
    'Could not parse request. Examples: "I took 50mL of Lot 902 for Project EXP-101", "Check in 25 of lot ETH-881", "Evaluate thresholds", "Show 30 day consumption by project"',
    400,
    "PARSE_FAILED",
  );
}

async function resolveReagentId(nameOrId: string): Promise<string> {
  const byId = await prisma.reagent.findUnique({ where: { reagentId: nameOrId } });
  if (byId) return byId.reagentId;

  const matches = await prisma.reagent.findMany({
    where: { reagentName: { contains: nameOrId } },
  });
  if (matches.length === 1) return matches[0].reagentId;
  if (matches.length === 0) {
    throw new AppError(`Reagent not found: ${nameOrId}`, 404, "REAGENT_NOT_FOUND");
  }
  throw new AppError(
    `Ambiguous reagent "${nameOrId}". Matches: ${matches.map((m) => m.reagentName).join(", ")}`,
    409,
    "REAGENT_AMBIGUOUS",
  );
}

async function maybeParseWithLlm(
  message: string,
  defaultUserId: string,
): Promise<AgentAction | null> {
  if (process.env.AGENT_USE_LLM !== "true") return null;

  const baseUrl = process.env.LLM_BASE_URL;
  if (!baseUrl) return null;

  const system = `You convert lab inventory natural language into one JSON action.
Tools:
- check_out_reagent: {lotNumber, quantity, userId, experimentIdOrProject?}
- check_in_reagent: {lotNumber, quantity, userId}
- evaluate_thresholds: {}
- generate_draft_po: {reagentId or reagentName as reagentId string}
- get_consumption_report: {days:30|60|90, groupBy:"project"|"reagent"}
Return ONLY JSON: {"tool":"...","args":{...}}. userId default: ${defaultUserId}`;

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY ?? "ollama"}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? "llama3.2",
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: message },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as AgentAction;
    if (!parsed?.tool) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function runAgentLoop(input: AgentRequestInput) {
  const userId = input.userId ?? process.env.DEFAULT_USER_ID ?? "lab-tech-001";
  const steps: Array<{ step: string; detail: unknown }> = [];

  let action =
    (await maybeParseWithLlm(input.message, userId)) ??
    parseNaturalLanguage(input.message, userId);

  steps.push({ step: "parse", detail: action });

  if (action.tool === "generate_draft_po") {
    const reagentId = await resolveReagentId(action.args.reagentId);
    action = { tool: "generate_draft_po", args: { reagentId } };
    steps.push({ step: "resolve_reagent", detail: { reagentId } });
  }

  let result: unknown;
  switch (action.tool) {
    case "check_out_reagent": {
      const validated = CheckOutInput.parse({ ...action.args, userId });
      result = await checkOutReagent(validated);
      steps.push({
        step: "execute_tool",
        detail: {
          tool: action.tool,
          reorderTriggered: (result as { reorder: { triggered: boolean } }).reorder
            .triggered,
        },
      });
      break;
    }
    case "check_in_reagent": {
      const validated = CheckInInput.parse({ ...action.args, userId });
      result = await checkInReagent(validated);
      steps.push({ step: "execute_tool", detail: { tool: action.tool } });
      break;
    }
    case "evaluate_thresholds": {
      result = await evaluateThresholds();
      steps.push({ step: "execute_tool", detail: { tool: action.tool } });
      break;
    }
    case "generate_draft_po": {
      result = await generateDraftPo(action.args.reagentId);
      steps.push({ step: "execute_tool", detail: { tool: action.tool } });
      break;
    }
    case "get_consumption_report": {
      result = await getConsumptionReport(action.args.days, action.args.groupBy);
      steps.push({ step: "execute_tool", detail: { tool: action.tool } });
      break;
    }
    default:
      throw new AppError("Unknown tool", 400, "UNKNOWN_TOOL");
  }

  return {
    message: input.message,
    userId,
    action,
    steps,
    result,
  };
}
