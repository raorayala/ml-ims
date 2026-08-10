import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ml-ims-test-"));
const dbPath = path.join(tmpDir, "test.db");
process.env.DATABASE_URL = `file:${dbPath}`;

// Import after DATABASE_URL is set so Prisma client binds to temp DB.
const { prisma } = await import("@ml-ims/db");
const { checkOutReagent, evaluateAndReorder } = await import("./inventoryService.js");

describe("inventory check-out and reorder", () => {
  beforeAll(() => {
    // Fresh empty SQLite file — non-destructive push creates schema only.
    const schemaDir = path.resolve(__dirname, "../../../db");
    execSync("npx prisma db push --skip-generate", {
      cwd: schemaDir,
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("checks out stock, writes audit row, and drafts PO when below threshold", async () => {
    const supplier = await prisma.supplier.create({
      data: {
        supplierName: "Test Supplier",
        contactEmail: "t@example.com",
        contactPhone: "555",
        accountNumber: "T-1",
      },
    });
    const reagent = await prisma.reagent.create({
      data: {
        reagentName: "Test Reagent",
        unitOfMeasure: "mL",
        minThresholdQuantity: 80,
        reorderQuantity: 200,
        supplierId: supplier.supplierId,
      },
    });
    await prisma.inventoryLot.create({
      data: {
        reagentId: reagent.reagentId,
        lotNumber: "LOT-T1",
        currentQuantity: 100,
        storageLocation: "Shelf A",
        expirationDate: new Date(Date.now() + 30 * 86400000),
        status: "Active",
      },
    });

    const result = await checkOutReagent({
      lotNumber: "LOT-T1",
      quantity: 30,
      userId: "tester",
      experimentIdOrProject: "EXP-T",
    });

    expect(Number(result.lot.currentQuantity)).toBe(70);
    expect(result.totalStock).toBe(70);
    expect(result.reorder.triggered).toBe(true);
    expect(result.reorder.purchaseOrder?.status).toBe("Draft");
    expect(result.reorder.purchaseOrder?.suggestedQuantity).toBeGreaterThanOrEqual(200);

    const tx = await prisma.inventoryTransaction.findFirst({
      where: { experimentIdOrProject: "EXP-T" },
    });
    expect(tx?.transactionType).toBe("Check-out");
    expect(Number(tx?.quantityChanged)).toBe(30);
  });

  it("rejects overdraft from Active lot", async () => {
    await expect(
      checkOutReagent({
        lotNumber: "LOT-T1",
        quantity: 9999,
        userId: "tester",
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_QUANTITY" });
  });

  it("does not create a second open PO while one exists", async () => {
    const reagent = await prisma.reagent.findFirst({
      where: { reagentName: "Test Reagent" },
    });
    expect(reagent).toBeTruthy();
    const again = await evaluateAndReorder(reagent!.reagentId);
    expect(again.triggered).toBe(true);
    expect(again.alert).toMatchObject({ existingPoId: expect.any(String) });
    const openCount = await prisma.purchaseOrder.count({
      where: {
        reagentId: reagent!.reagentId,
        status: { in: ["Draft", "Pending Approval", "Submitted"] },
      },
    });
    expect(openCount).toBe(1);
  });
});
