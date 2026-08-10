import { prisma } from "@ml-ims/db";
import { decimalToNumber } from "@ml-ims/shared";

function toNum(value: { toString(): string } | number | string): number {
  return decimalToNumber(value);
}

export async function getStockSummary() {
  const lots = await prisma.inventoryLot.findMany({
    include: {
      reagent: {
        select: {
          reagentId: true,
          reagentName: true,
          unitOfMeasure: true,
          minThresholdQuantity: true,
        },
      },
    },
    orderBy: [{ storageLocation: "asc" }, { expirationDate: "asc" }],
  });

  const byLocation = new Map<
    string,
    {
      storageLocation: string;
      totalLots: number;
      totalQuantity: number;
      reagents: Map<string, { name: string; unit: string; quantity: number }>;
      expiringSoon: Array<{
        lotNumber: string;
        reagentName: string;
        expirationDate: string;
        daysUntilExpiry: number;
      }>;
    }
  >();

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const lot of lots) {
    const key = lot.storageLocation;
    if (!byLocation.has(key)) {
      byLocation.set(key, {
        storageLocation: key,
        totalLots: 0,
        totalQuantity: 0,
        reagents: new Map(),
        expiringSoon: [],
      });
    }
    const bucket = byLocation.get(key)!;
    const qty = toNum(lot.currentQuantity);
    bucket.totalLots += 1;
    if (lot.status === "Active") bucket.totalQuantity += qty;

    const rKey = lot.reagent.reagentId;
    const existing = bucket.reagents.get(rKey);
    if (existing) {
      existing.quantity += lot.status === "Active" ? qty : 0;
    } else {
      bucket.reagents.set(rKey, {
        name: lot.reagent.reagentName,
        unit: lot.reagent.unitOfMeasure,
        quantity: lot.status === "Active" ? qty : 0,
      });
    }

    const daysUntil = Math.ceil(
      (lot.expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (daysUntil <= 90 && lot.status === "Active") {
      bucket.expiringSoon.push({
        lotNumber: lot.lotNumber,
        reagentName: lot.reagent.reagentName,
        expirationDate: lot.expirationDate.toISOString().slice(0, 10),
        daysUntilExpiry: daysUntil,
      });
    }
  }

  return Array.from(byLocation.values()).map((b) => ({
    storageLocation: b.storageLocation,
    totalLots: b.totalLots,
    totalQuantity: b.totalQuantity,
    reagents: Array.from(b.reagents.values()),
    expiringSoon: b.expiringSoon.sort((a, c) => a.daysUntilExpiry - c.daysUntilExpiry),
  }));
}

export async function getConsumptionReport(
  days: 30 | 60 | 90 = 30,
  groupBy: "project" | "reagent" = "project",
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const txns = await prisma.inventoryTransaction.findMany({
    where: {
      transactionType: "Check-out",
      timestamp: { gte: since },
    },
    include: {
      lot: {
        include: {
          reagent: {
            select: {
              reagentId: true,
              reagentName: true,
              unitOfMeasure: true,
            },
          },
        },
      },
    },
    orderBy: { timestamp: "asc" },
  });

  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      totalConsumed: number;
      unitOfMeasure?: string;
      transactions: number;
      series: Array<{ date: string; quantity: number }>;
    }
  >();

  for (const t of txns) {
    const key =
      groupBy === "project"
        ? t.experimentIdOrProject ?? "UNASSIGNED"
        : t.lot.reagent.reagentId;
    const label =
      groupBy === "project"
        ? t.experimentIdOrProject ?? "UNASSIGNED"
        : t.lot.reagent.reagentName;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        totalConsumed: 0,
        unitOfMeasure: t.lot.reagent.unitOfMeasure,
        transactions: 0,
        series: [],
      });
    }
    const g = groups.get(key)!;
    const qty = toNum(t.quantityChanged);
    g.totalConsumed += qty;
    g.transactions += 1;
    const date = t.timestamp.toISOString().slice(0, 10);
    const point = g.series.find((s) => s.date === date);
    if (point) point.quantity += qty;
    else g.series.push({ date, quantity: qty });
  }

  return {
    days,
    groupBy,
    since: since.toISOString(),
    groups: Array.from(groups.values()).sort(
      (a, b) => b.totalConsumed - a.totalConsumed,
    ),
  };
}

export async function getExpirationTracking() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const windows = [30, 60, 90] as const;
  const lots = await prisma.inventoryLot.findMany({
    where: {
      status: { in: ["Active", "Quarantined"] },
      expirationDate: {
        lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      reagent: {
        select: {
          reagentName: true,
          unitOfMeasure: true,
        },
      },
    },
    orderBy: { expirationDate: "asc" },
  });

  const result: Record<string, unknown[]> = {
    within30Days: [],
    within60Days: [],
    within90Days: [],
  };

  for (const lot of lots) {
    const daysUntil = Math.ceil(
      (lot.expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );
    const item = {
      lotId: lot.lotId,
      lotNumber: lot.lotNumber,
      reagentName: lot.reagent.reagentName,
      unitOfMeasure: lot.reagent.unitOfMeasure,
      currentQuantity: toNum(lot.currentQuantity),
      storageLocation: lot.storageLocation,
      expirationDate: lot.expirationDate.toISOString().slice(0, 10),
      daysUntilExpiry: daysUntil,
      status: lot.status,
    };
    if (daysUntil <= 30) result.within30Days.push(item);
    if (daysUntil <= 60) result.within60Days.push(item);
    if (daysUntil <= 90) result.within90Days.push(item);
  }

  return { asOf: now.toISOString(), windows, ...result };
}

export async function getDashboard() {
  const [reagents, lots, recentTx, openPos, lowStock] = await Promise.all([
    prisma.reagent.findMany({
      include: {
        supplier: true,
        lots: true,
      },
      orderBy: { reagentName: "asc" },
    }),
    prisma.inventoryLot.findMany({
      include: { reagent: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.inventoryTransaction.findMany({
      take: 50,
      orderBy: { timestamp: "desc" },
      include: {
        lot: {
          include: {
            reagent: { select: { reagentName: true, unitOfMeasure: true } },
          },
        },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["Draft", "Pending Approval", "Submitted"] } },
      include: {
        reagent: true,
        supplier: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reagent.findMany({ include: { lots: true, supplier: true } }),
  ]);

  const lowStockAlerts = lowStock
    .map((r) => {
      const total = r.lots
        .filter((l) => l.status === "Active")
        .reduce((s, l) => s + toNum(l.currentQuantity), 0);
      return {
        reagentId: r.reagentId,
        reagentName: r.reagentName,
        unitOfMeasure: r.unitOfMeasure,
        totalStock: total,
        minThreshold: toNum(r.minThresholdQuantity),
        isLow: total <= toNum(r.minThresholdQuantity),
        supplierName: r.supplier.supplierName,
      };
    })
    .filter((r) => r.isLow);

  return {
    reagents: reagents.map((r) => ({
      reagentId: r.reagentId,
      reagentName: r.reagentName,
      unitOfMeasure: r.unitOfMeasure,
      minThresholdQuantity: toNum(r.minThresholdQuantity),
      reorderQuantity: toNum(r.reorderQuantity),
      barcode: r.barcode,
      supplierName: r.supplier.supplierName,
      totalStock: r.lots
        .filter((l) => l.status === "Active")
        .reduce((s, l) => s + toNum(l.currentQuantity), 0),
      lotCount: r.lots.length,
    })),
    lots: lots.map((l) => ({
      lotId: l.lotId,
      lotNumber: l.lotNumber,
      reagentName: l.reagent.reagentName,
      currentQuantity: toNum(l.currentQuantity),
      unitOfMeasure: l.reagent.unitOfMeasure,
      storageLocation: l.storageLocation,
      expirationDate: l.expirationDate.toISOString().slice(0, 10),
      status: l.status,
    })),
    recentTransactions: recentTx.map((t) => ({
      transactionId: t.transactionId,
      lotNumber: t.lot.lotNumber,
      reagentName: t.lot.reagent.reagentName,
      unitOfMeasure: t.lot.reagent.unitOfMeasure,
      userId: t.userId,
      transactionType: t.transactionType,
      quantityChanged: toNum(t.quantityChanged),
      experimentIdOrProject: t.experimentIdOrProject,
      timestamp: t.timestamp.toISOString(),
    })),
    openPurchaseOrders: openPos.map((p) => ({
      poId: p.poId,
      reagentName: p.reagent.reagentName,
      supplierName: p.supplier.supplierName,
      suggestedQuantity: toNum(p.suggestedQuantity),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      alert: p.alertPayload ? JSON.parse(p.alertPayload) : null,
    })),
    lowStockAlerts,
  };
}
