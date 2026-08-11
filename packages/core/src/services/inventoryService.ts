import { prisma, Prisma } from "@ml-ims/db";
import {
  AppError,
  CheckInInput,
  CheckOutInput,
  decimalToNumber,
} from "@ml-ims/shared";

const OPEN_PO_STATUSES = ["Draft", "Pending Approval", "Submitted"] as const;

function toNum(value: Prisma.Decimal | number | string): number {
  return decimalToNumber(value);
}

async function resolveLot(input: {
  lotId?: string;
  lotNumber?: string;
  reagentName?: string;
}) {
  if (input.lotId) {
    const lot = await prisma.inventoryLot.findUnique({
      where: { lotId: input.lotId },
      include: { reagent: true },
    });
    if (!lot) throw new AppError("Lot not found", 404, "LOT_NOT_FOUND");
    return lot;
  }

  if (!input.lotNumber) {
    throw new AppError("lotId or lotNumber is required", 400, "LOT_REQUIRED");
  }

  const lots = await prisma.inventoryLot.findMany({
    where: {
      lotNumber: input.lotNumber,
      ...(input.reagentName
        ? {
            reagent: {
              reagentName: { contains: input.reagentName },
            },
          }
        : {}),
    },
    include: { reagent: true },
  });

  if (lots.length === 0) {
    throw new AppError(
      `No lot found for lot number ${input.lotNumber}`,
      404,
      "LOT_NOT_FOUND",
    );
  }
  if (lots.length > 1) {
    throw new AppError(
      `Ambiguous lot number ${input.lotNumber}; provide reagentName or lotId`,
      409,
      "LOT_AMBIGUOUS",
    );
  }
  return lots[0];
}

export async function getActiveStockForReagent(reagentId: string): Promise<number> {
  const lots = await prisma.inventoryLot.findMany({
    where: { reagentId, status: "Active" },
    select: { currentQuantity: true },
  });
  return lots.reduce((sum, lot) => sum + toNum(lot.currentQuantity), 0);
}

export async function getAverageMonthlyConsumption(reagentId: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const txns = await prisma.inventoryTransaction.findMany({
    where: {
      transactionType: "Check-out",
      timestamp: { gte: since },
      lot: { reagentId },
    },
    select: { quantityChanged: true },
  });

  const total = txns.reduce((sum, t) => sum + toNum(t.quantityChanged), 0);
  // 90-day window → monthly average
  return total / 3;
}

export type ReorderResult = {
  triggered: boolean;
  totalStock: number;
  minThreshold: number;
  purchaseOrder?: {
    poId: string;
    suggestedQuantity: number;
    status: string;
  };
  alert?: Record<string, unknown>;
};

export async function evaluateAndReorder(
  reagentId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<ReorderResult> {
  const reagent = await tx.reagent.findUnique({
    where: { reagentId },
    include: { supplier: true },
  });
  if (!reagent) throw new AppError("Reagent not found", 404, "REAGENT_NOT_FOUND");

  const activeLots = await tx.inventoryLot.findMany({
    where: { reagentId, status: "Active" },
    select: { currentQuantity: true },
  });
  const totalStock = activeLots.reduce((s, l) => s + toNum(l.currentQuantity), 0);
  const minThreshold = toNum(reagent.minThresholdQuantity);

  if (totalStock > minThreshold) {
    return { triggered: false, totalStock, minThreshold };
  }

  const existingOpenPo = await tx.purchaseOrder.findFirst({
    where: {
      reagentId,
      status: { in: [...OPEN_PO_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingOpenPo) {
    return {
      triggered: true,
      totalStock,
      minThreshold,
      purchaseOrder: {
        poId: existingOpenPo.poId,
        suggestedQuantity: toNum(existingOpenPo.suggestedQuantity),
        status: existingOpenPo.status,
      },
      alert: {
        type: "LOW_STOCK",
        message: `Low stock for ${reagent.reagentName}; open PO already exists`,
        reagentId,
        totalStock,
        minThreshold,
        existingPoId: existingOpenPo.poId,
      },
    };
  }

  const since = new Date();
  since.setDate(since.getDate() - 90);
  const txns = await tx.inventoryTransaction.findMany({
    where: {
      transactionType: "Check-out",
      timestamp: { gte: since },
      lot: { reagentId },
    },
    select: { quantityChanged: true },
  });
  const avgMonthly = txns.reduce((s, t) => s + toNum(t.quantityChanged), 0) / 3;
  const standardReorder = toNum(reagent.reorderQuantity);
  const suggested = Math.max(
    standardReorder,
    avgMonthly * 1.5 - totalStock,
  );

  const alert = {
    type: "LOW_STOCK",
    severity: "warning",
    message: `Stock for ${reagent.reagentName} is ${totalStock} ${reagent.unitOfMeasure} (threshold ${minThreshold}). Draft PO generated.`,
    reagentId,
    reagentName: reagent.reagentName,
    unitOfMeasure: reagent.unitOfMeasure,
    totalStock,
    minThreshold,
    suggestedQuantity: suggested,
    supplier: {
      supplierId: reagent.supplier.supplierId,
      supplierName: reagent.supplier.supplierName,
      contactEmail: reagent.supplier.contactEmail,
    },
    createdAt: new Date().toISOString(),
  };

  const po = await tx.purchaseOrder.create({
    data: {
      reagentId,
      supplierId: reagent.supplierId,
      suggestedQuantity: suggested,
      status: "Draft",
      alertPayload: JSON.stringify(alert),
    },
  });

  return {
    triggered: true,
    totalStock,
    minThreshold,
    purchaseOrder: {
      poId: po.poId,
      suggestedQuantity: suggested,
      status: po.status,
    },
    alert,
  };
}

export async function checkOutReagent(input: CheckOutInput) {
  if (!input.userId) {
    throw new AppError("Authenticated user is required", 401, "UNAUTHORIZED");
  }
  const actingUserId = input.userId;

  return prisma.$transaction(async (tx) => {
    const lot = await resolveLot(input);

    // Re-read inside transaction for isolation
    const locked = await tx.inventoryLot.findUnique({
      where: { lotId: lot.lotId },
      include: { reagent: true },
    });
    if (!locked) throw new AppError("Lot not found", 404, "LOT_NOT_FOUND");

    if (locked.status !== "Active") {
      throw new AppError(
        `Lot ${locked.lotNumber} is not Active (status=${locked.status})`,
        409,
        "LOT_NOT_ACTIVE",
      );
    }

    const current = toNum(locked.currentQuantity);
    if (input.quantity > current) {
      throw new AppError(
        `Insufficient quantity: requested ${input.quantity}, available ${current}`,
        409,
        "INSUFFICIENT_QUANTITY",
      );
    }

    const nextQty = current - input.quantity;
    const nextStatus = nextQty <= 0 ? "Depleted" : "Active";

    const updatedLot = await tx.inventoryLot.update({
      where: { lotId: locked.lotId },
      data: {
        currentQuantity: nextQty,
        status: nextStatus,
      },
    });

    const transaction = await tx.inventoryTransaction.create({
      data: {
        lotId: locked.lotId,
        userId: actingUserId,
        transactionType: "Check-out",
        quantityChanged: input.quantity,
        experimentIdOrProject: input.experimentIdOrProject,
        notes: input.notes,
      },
    });

    const reorder = await evaluateAndReorder(locked.reagentId, tx);
    const totalStock = reorder.totalStock;

    return {
      transaction,
      lot: updatedLot,
      reagent: locked.reagent,
      totalStock,
      reorder,
    };
  });
}

export async function checkInReagent(input: CheckInInput) {
  if (!input.userId) {
    throw new AppError("Authenticated user is required", 401, "UNAUTHORIZED");
  }
  const actingUserId = input.userId;

  return prisma.$transaction(async (tx) => {
    const lot = await resolveLot(input);
    const locked = await tx.inventoryLot.findUnique({
      where: { lotId: lot.lotId },
      include: { reagent: true },
    });
    if (!locked) throw new AppError("Lot not found", 404, "LOT_NOT_FOUND");

    if (locked.status === "Expired" || locked.status === "Quarantined") {
      throw new AppError(
        `Cannot check in to ${locked.status} lot ${locked.lotNumber}`,
        409,
        "LOT_NOT_ACCEPTING",
      );
    }

    const current = toNum(locked.currentQuantity);
    const nextQty = current + input.quantity;

    const updatedLot = await tx.inventoryLot.update({
      where: { lotId: locked.lotId },
      data: {
        currentQuantity: nextQty,
        status: "Active",
      },
    });

    const transaction = await tx.inventoryTransaction.create({
      data: {
        lotId: locked.lotId,
        userId: actingUserId,
        transactionType: "Check-in",
        quantityChanged: input.quantity,
        experimentIdOrProject: input.experimentIdOrProject,
        notes: input.notes,
      },
    });

    const activeLots = await tx.inventoryLot.findMany({
      where: { reagentId: locked.reagentId, status: "Active" },
      select: { currentQuantity: true },
    });
    const totalStock = activeLots.reduce((s, l) => s + toNum(l.currentQuantity), 0);

    return {
      transaction,
      lot: updatedLot,
      reagent: locked.reagent,
      totalStock,
    };
  });
}

export async function generateDraftPo(reagentId: string) {
  return prisma.$transaction(async (tx) => evaluateAndReorder(reagentId, tx));
}

export async function evaluateThresholds() {
  const reagents = await prisma.reagent.findMany({ select: { reagentId: true } });
  const results = [];
  for (const r of reagents) {
    const result = await evaluateAndReorder(r.reagentId);
    if (result.triggered) results.push({ reagentId: r.reagentId, ...result });
  }
  return {
    evaluated: reagents.length,
    alerts: results,
  };
}
