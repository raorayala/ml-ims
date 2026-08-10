import { prisma } from "@ml-ims/db";
import {
  AppError,
  InventoryLotInput,
  InventoryLotUpdateInput,
  ReagentInput,
  SupplierInput,
} from "@ml-ims/shared";

function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(`Invalid date: ${value}`, 400, "INVALID_DATE");
  }
  return d;
}

export async function listSuppliers() {
  return prisma.supplier.findMany({ orderBy: { supplierName: "asc" } });
}

export async function createSupplier(input: SupplierInput) {
  return prisma.supplier.create({ data: input });
}

export async function updateSupplier(supplierId: string, input: SupplierInput) {
  try {
    return await prisma.supplier.update({
      where: { supplierId },
      data: input,
    });
  } catch {
    throw new AppError("Supplier not found", 404, "SUPPLIER_NOT_FOUND");
  }
}

export async function deleteSupplier(supplierId: string) {
  const linked = await prisma.reagent.count({ where: { supplierId } });
  if (linked > 0) {
    throw new AppError(
      "Cannot delete supplier with linked reagents",
      409,
      "SUPPLIER_IN_USE",
    );
  }
  try {
    await prisma.supplier.delete({ where: { supplierId } });
  } catch {
    throw new AppError("Supplier not found", 404, "SUPPLIER_NOT_FOUND");
  }
  return { deleted: true, supplierId };
}

export async function createReagent(input: ReagentInput) {
  const supplier = await prisma.supplier.findUnique({
    where: { supplierId: input.supplierId },
  });
  if (!supplier) throw new AppError("Supplier not found", 404, "SUPPLIER_NOT_FOUND");

  try {
    return await prisma.reagent.create({
      data: {
        reagentName: input.reagentName,
        unitOfMeasure: input.unitOfMeasure,
        minThresholdQuantity: input.minThresholdQuantity,
        reorderQuantity: input.reorderQuantity,
        supplierId: input.supplierId,
        barcode: input.barcode ?? null,
      },
      include: { supplier: true },
    });
  } catch {
    throw new AppError(
      "Could not create reagent (barcode may already exist)",
      409,
      "REAGENT_CREATE_FAILED",
    );
  }
}

export async function updateReagent(reagentId: string, input: ReagentInput) {
  const supplier = await prisma.supplier.findUnique({
    where: { supplierId: input.supplierId },
  });
  if (!supplier) throw new AppError("Supplier not found", 404, "SUPPLIER_NOT_FOUND");

  try {
    return await prisma.reagent.update({
      where: { reagentId },
      data: {
        reagentName: input.reagentName,
        unitOfMeasure: input.unitOfMeasure,
        minThresholdQuantity: input.minThresholdQuantity,
        reorderQuantity: input.reorderQuantity,
        supplierId: input.supplierId,
        barcode: input.barcode ?? null,
      },
      include: { supplier: true },
    });
  } catch {
    throw new AppError("Reagent not found", 404, "REAGENT_NOT_FOUND");
  }
}

export async function deleteReagent(reagentId: string) {
  const lots = await prisma.inventoryLot.count({ where: { reagentId } });
  if (lots > 0) {
    throw new AppError(
      "Cannot delete reagent with existing lots",
      409,
      "REAGENT_IN_USE",
    );
  }
  try {
    await prisma.reagent.delete({ where: { reagentId } });
  } catch {
    throw new AppError("Reagent not found", 404, "REAGENT_NOT_FOUND");
  }
  return { deleted: true, reagentId };
}

export async function createLot(input: InventoryLotInput) {
  const reagent = await prisma.reagent.findUnique({
    where: { reagentId: input.reagentId },
  });
  if (!reagent) throw new AppError("Reagent not found", 404, "REAGENT_NOT_FOUND");

  try {
    return await prisma.inventoryLot.create({
      data: {
        reagentId: input.reagentId,
        lotNumber: input.lotNumber,
        currentQuantity: input.currentQuantity,
        storageLocation: input.storageLocation,
        expirationDate: parseDate(input.expirationDate),
        status: input.status,
      },
      include: { reagent: true },
    });
  } catch {
    throw new AppError(
      "Could not create lot (lot number may already exist for this reagent)",
      409,
      "LOT_CREATE_FAILED",
    );
  }
}

export async function updateLot(lotId: string, input: InventoryLotUpdateInput) {
  try {
    return await prisma.inventoryLot.update({
      where: { lotId },
      data: {
        ...(input.currentQuantity !== undefined
          ? { currentQuantity: input.currentQuantity }
          : {}),
        ...(input.storageLocation !== undefined
          ? { storageLocation: input.storageLocation }
          : {}),
        ...(input.expirationDate !== undefined
          ? { expirationDate: parseDate(input.expirationDate) }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: { reagent: true },
    });
  } catch {
    throw new AppError("Lot not found", 404, "LOT_NOT_FOUND");
  }
}

export async function deleteLot(lotId: string) {
  const txCount = await prisma.inventoryTransaction.count({ where: { lotId } });
  if (txCount > 0) {
    throw new AppError(
      "Cannot delete lot with audit transactions; mark Depleted/Quarantined instead",
      409,
      "LOT_HAS_HISTORY",
    );
  }
  try {
    await prisma.inventoryLot.delete({ where: { lotId } });
  } catch {
    throw new AppError("Lot not found", 404, "LOT_NOT_FOUND");
  }
  return { deleted: true, lotId };
}
