import { z } from "zod";

export const UnitOfMeasure = z.enum(["mL", "L", "g", "kg", "vials", "packs"]);
export type UnitOfMeasure = z.infer<typeof UnitOfMeasure>;

export const LotStatus = z.enum(["Active", "Depleted", "Expired", "Quarantined"]);
export type LotStatus = z.infer<typeof LotStatus>;

export const TransactionType = z.enum([
  "Check-out",
  "Check-in",
  "Disposal",
  "Adjustment",
]);
export type TransactionType = z.infer<typeof TransactionType>;

export const PurchaseOrderStatus = z.enum([
  "Draft",
  "Pending Approval",
  "Submitted",
  "Received",
]);
export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatus>;

export const CheckOutInput = z.object({
  lotId: z.string().uuid().optional(),
  lotNumber: z.string().min(1).optional(),
  reagentName: z.string().min(1).optional(),
  quantity: z.number().positive(),
  userId: z.string().min(1),
  experimentIdOrProject: z.string().min(1).optional(),
  notes: z.string().optional(),
}).refine((v) => Boolean(v.lotId || v.lotNumber), {
  message: "Either lotId or lotNumber is required",
});

export type CheckOutInput = z.infer<typeof CheckOutInput>;

export const CheckInInput = z.object({
  lotId: z.string().uuid().optional(),
  lotNumber: z.string().min(1).optional(),
  quantity: z.number().positive(),
  userId: z.string().min(1),
  experimentIdOrProject: z.string().min(1).optional(),
  notes: z.string().optional(),
}).refine((v) => Boolean(v.lotId || v.lotNumber), {
  message: "Either lotId or lotNumber is required",
});

export type CheckInInput = z.infer<typeof CheckInInput>;

export const ConsumptionReportInput = z.object({
  days: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(30),
  groupBy: z.enum(["project", "reagent"]).default("project"),
});

export type ConsumptionReportInput = z.infer<typeof ConsumptionReportInput>;

export const AgentRequestInput = z.object({
  message: z.string().min(1),
  userId: z.string().min(1).optional(),
});

export type AgentRequestInput = z.infer<typeof AgentRequestInput>;

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function decimalToNumber(value: { toString(): string } | number | string): number {
  return typeof value === "number" ? value : Number(value.toString());
}
