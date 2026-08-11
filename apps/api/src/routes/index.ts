import { Router } from "express";
import {
  AgentRequestInput,
  CheckInInput,
  CheckOutInput,
  ConsumptionReportInput,
  InventoryLotInput,
  InventoryLotUpdateInput,
  PurchaseOrderStatus,
  ReagentInput,
  SupplierInput,
} from "@ml-ims/shared";
import {
  checkInReagent,
  checkOutReagent,
  createLot,
  createReagent,
  createSupplier,
  deleteLot,
  deleteReagent,
  deleteSupplier,
  evaluateThresholds,
  generateDraftPo,
  listSuppliers,
  updateLot,
  updateReagent,
  updateSupplier,
} from "@ml-ims/core";
import {
  getConsumptionReport,
  getDashboard,
  getExpirationTracking,
  getStockSummary,
} from "../services/reportingService.js";
import { quarantineExpiredLots } from "../services/expirationCron.js";
import { runAgentLoop } from "../services/agentService.js";
import { prisma } from "@ml-ims/db";
import { z } from "zod";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "ml-ims-api" });
});

router.get("/ready", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ready: true, database: "up" });
  } catch (e) {
    next(e);
  }
});

router.get("/dashboard", async (_req, res, next) => {
  try {
    res.json(await getDashboard());
  } catch (e) {
    next(e);
  }
});

router.get("/suppliers", async (_req, res, next) => {
  try {
    res.json(await listSuppliers());
  } catch (e) {
    next(e);
  }
});

router.post("/suppliers", async (req, res, next) => {
  try {
    res.status(201).json(await createSupplier(SupplierInput.parse(req.body)));
  } catch (e) {
    next(e);
  }
});

router.put("/suppliers/:supplierId", async (req, res, next) => {
  try {
    res.json(
      await updateSupplier(req.params.supplierId, SupplierInput.parse(req.body)),
    );
  } catch (e) {
    next(e);
  }
});

router.delete("/suppliers/:supplierId", async (req, res, next) => {
  try {
    res.json(await deleteSupplier(req.params.supplierId));
  } catch (e) {
    next(e);
  }
});

router.get("/reagents", async (_req, res, next) => {
  try {
    const reagents = await prisma.reagent.findMany({
      include: { supplier: true, lots: true },
      orderBy: { reagentName: "asc" },
    });
    res.json(reagents);
  } catch (e) {
    next(e);
  }
});

router.post("/reagents", async (req, res, next) => {
  try {
    res.status(201).json(await createReagent(ReagentInput.parse(req.body)));
  } catch (e) {
    next(e);
  }
});

router.put("/reagents/:reagentId", async (req, res, next) => {
  try {
    res.json(await updateReagent(req.params.reagentId, ReagentInput.parse(req.body)));
  } catch (e) {
    next(e);
  }
});

router.delete("/reagents/:reagentId", async (req, res, next) => {
  try {
    res.json(await deleteReagent(req.params.reagentId));
  } catch (e) {
    next(e);
  }
});

router.get("/lots", async (_req, res, next) => {
  try {
    const lots = await prisma.inventoryLot.findMany({
      include: { reagent: true },
      orderBy: { lotNumber: "asc" },
    });
    res.json(lots);
  } catch (e) {
    next(e);
  }
});

router.post("/lots", async (req, res, next) => {
  try {
    res.status(201).json(await createLot(InventoryLotInput.parse(req.body)));
  } catch (e) {
    next(e);
  }
});

router.patch("/lots/:lotId", async (req, res, next) => {
  try {
    res.json(
      await updateLot(req.params.lotId, InventoryLotUpdateInput.parse(req.body)),
    );
  } catch (e) {
    next(e);
  }
});

router.delete("/lots/:lotId", async (req, res, next) => {
  try {
    res.json(await deleteLot(req.params.lotId));
  } catch (e) {
    next(e);
  }
});

router.get("/transactions", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const txns = await prisma.inventoryTransaction.findMany({
      take: limit,
      orderBy: { timestamp: "desc" },
      include: {
        lot: { include: { reagent: true } },
      },
    });
    res.json(txns);
  } catch (e) {
    next(e);
  }
});

router.post("/inventory/check-out", async (req, res, next) => {
  try {
    const input = CheckOutInput.parse(req.body);
    res.status(201).json(await checkOutReagent(input));
  } catch (e) {
    next(e);
  }
});

router.post("/inventory/check-in", async (req, res, next) => {
  try {
    const input = CheckInInput.parse(req.body);
    res.status(201).json(await checkInReagent(input));
  } catch (e) {
    next(e);
  }
});

router.post("/inventory/evaluate-thresholds", async (_req, res, next) => {
  try {
    res.json(await evaluateThresholds());
  } catch (e) {
    next(e);
  }
});

router.post("/purchase-orders/draft", async (req, res, next) => {
  try {
    const body = z.object({ reagentId: z.string().uuid() }).parse(req.body);
    res.status(201).json(await generateDraftPo(body.reagentId));
  } catch (e) {
    next(e);
  }
});

router.get("/purchase-orders", async (_req, res, next) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: { reagent: true, supplier: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (e) {
    next(e);
  }
});

router.patch("/purchase-orders/:poId/status", async (req, res, next) => {
  try {
    const status = PurchaseOrderStatus.parse(req.body.status);
    const updated = await prisma.purchaseOrder.update({
      where: { poId: req.params.poId },
      data: { status },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.get("/reports/stock-summary", async (_req, res, next) => {
  try {
    res.json(await getStockSummary());
  } catch (e) {
    next(e);
  }
});

router.get("/reports/consumption", async (req, res, next) => {
  try {
    const input = ConsumptionReportInput.parse({
      days: req.query.days ? Number(req.query.days) : 30,
      groupBy: req.query.groupBy ?? "project",
    });
    res.json(await getConsumptionReport(input.days, input.groupBy));
  } catch (e) {
    next(e);
  }
});

router.get("/reports/expirations", async (_req, res, next) => {
  try {
    res.json(await getExpirationTracking());
  } catch (e) {
    next(e);
  }
});

router.post("/jobs/quarantine-expired", async (_req, res, next) => {
  try {
    const count = await quarantineExpiredLots();
    res.json({ quarantined: count });
  } catch (e) {
    next(e);
  }
});

router.post("/agent/execute", async (req, res, next) => {
  try {
    const input = AgentRequestInput.parse(req.body);
    res.json(await runAgentLoop(input));
  } catch (e) {
    next(e);
  }
});
