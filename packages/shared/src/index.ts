import { z } from "zod";

export const UserRole = z.enum(["ADMIN", "LAB_USER"]);
export type UserRole = z.infer<typeof UserRole>;

export const LoginInput = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const CreateUserInput = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/, {
    message: "Username may contain letters, numbers, '.', '_' or '-'",
  }),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(120),
  role: UserRole.default("LAB_USER"),
});
export type CreateUserInput = z.infer<typeof CreateUserInput>;

export const UpdateUserInput = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(1).max(120).optional(),
  role: UserRole.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;

export const ResetPasswordInput = z.object({
  password: z.string().min(8).max(128),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;

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
  /** Prefer omitting; authenticated API routes bind this from the session. */
  userId: z.string().min(1).optional(),
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
  /** Prefer omitting; authenticated API routes bind this from the session. */
  userId: z.string().min(1).optional(),
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

export const SupplierInput = z.object({
  supplierName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(1),
  accountNumber: z.string().min(1),
});
export type SupplierInput = z.infer<typeof SupplierInput>;

export const ReagentInput = z.object({
  reagentName: z.string().min(1),
  unitOfMeasure: UnitOfMeasure,
  minThresholdQuantity: z.number().nonnegative(),
  reorderQuantity: z.number().positive(),
  supplierId: z.string().uuid(),
  barcode: z.string().min(1).optional().nullable(),
});
export type ReagentInput = z.infer<typeof ReagentInput>;

export const InventoryLotInput = z.object({
  reagentId: z.string().uuid(),
  lotNumber: z.string().min(1),
  currentQuantity: z.number().nonnegative(),
  storageLocation: z.string().min(1),
  expirationDate: z.string().min(1), // ISO date YYYY-MM-DD or full ISO
  status: LotStatus.default("Active"),
});
export type InventoryLotInput = z.infer<typeof InventoryLotInput>;

export const InventoryLotUpdateInput = z.object({
  currentQuantity: z.number().nonnegative().optional(),
  storageLocation: z.string().min(1).optional(),
  expirationDate: z.string().min(1).optional(),
  status: LotStatus.optional(),
});
export type InventoryLotUpdateInput = z.infer<typeof InventoryLotUpdateInput>;

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
