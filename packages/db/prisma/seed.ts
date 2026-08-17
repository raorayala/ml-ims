import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  await prisma.inventoryTransaction.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.inventoryLot.deleteMany();
  await prisma.reagent.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("changeme123", 12);
  await prisma.user.createMany({
    data: [
      {
        username: "admin",
        email: "admin@ml-ims.local",
        passwordHash,
        role: "ADMIN",
        fullName: "Lab Administrator",
      },
      {
        username: "lab-tech-001",
        email: "lab-tech-001@ml-ims.local",
        passwordHash,
        role: "LAB_USER",
        fullName: "Lab Technician 001",
      },
      {
        username: "lab-tech-002",
        email: "lab-tech-002@ml-ims.local",
        passwordHash,
        role: "LAB_USER",
        fullName: "Lab Technician 002",
      },
    ],
  });


  const thermo = await prisma.supplier.create({
    data: {
      supplierName: "Thermo Fisher Scientific",
      contactEmail: "orders@thermofisher.example",
      contactPhone: "+1-800-555-0101",
      accountNumber: "TF-88231",
    },
  });

  const sigma = await prisma.supplier.create({
    data: {
      supplierName: "Sigma-Aldrich",
      contactEmail: "lab@sigma.example",
      contactPhone: "+1-800-555-0102",
      accountNumber: "SA-44109",
    },
  });

  const vwr = await prisma.supplier.create({
    data: {
      supplierName: "VWR International",
      contactEmail: "supply@vwr.example",
      contactPhone: "+1-800-555-0103",
      accountNumber: "VWR-99012",
    },
  });

  const ethanol = await prisma.reagent.create({
    data: {
      reagentName: "Ethanol Absolute",
      unitOfMeasure: "mL",
      minThresholdQuantity: 500,
      reorderQuantity: 2000,
      supplierId: thermo.supplierId,
      barcode: "REAG-ETH-ABS",
    },
  });

  const pbs = await prisma.reagent.create({
    data: {
      reagentName: "PBS Buffer 10X",
      unitOfMeasure: "mL",
      minThresholdQuantity: 250,
      reorderQuantity: 1000,
      supplierId: sigma.supplierId,
      barcode: "REAG-PBS-10X",
    },
  });

  const agar = await prisma.reagent.create({
    data: {
      reagentName: "Tryptic Soy Agar",
      unitOfMeasure: "g",
      minThresholdQuantity: 100,
      reorderQuantity: 500,
      supplierId: vwr.supplierId,
      barcode: "REAG-TSA-500",
    },
  });

  const glycerol = await prisma.reagent.create({
    data: {
      reagentName: "Glycerol Sterile",
      unitOfMeasure: "mL",
      minThresholdQuantity: 200,
      reorderQuantity: 1000,
      supplierId: thermo.supplierId,
      barcode: "REAG-GLY-STL",
    },
  });

  const amp = await prisma.reagent.create({
    data: {
      reagentName: "Ampicillin Sodium",
      unitOfMeasure: "vials",
      minThresholdQuantity: 5,
      reorderQuantity: 20,
      supplierId: sigma.supplierId,
      barcode: "REAG-AMP-SOD",
    },
  });

  const lot902 = await prisma.inventoryLot.create({
    data: {
      reagentId: ethanol.reagentId,
      lotNumber: "902",
      currentQuantity: 1200,
      storageLocation: "Flammable Cabinet A1",
      expirationDate: daysFromNow(180),
      status: "Active",
    },
  });

  await prisma.inventoryLot.createMany({
    data: [
      {
        reagentId: ethanol.reagentId,
        lotNumber: "ETH-881",
        currentQuantity: 350,
        storageLocation: "Flammable Cabinet A1",
        expirationDate: daysFromNow(25),
        status: "Active",
      },
      {
        reagentId: pbs.reagentId,
        lotNumber: "PBS-2201",
        currentQuantity: 180,
        storageLocation: "Cold Room Shelf B2",
        expirationDate: daysFromNow(45),
        status: "Active",
      },
      {
        reagentId: pbs.reagentId,
        lotNumber: "PBS-2208",
        currentQuantity: 400,
        storageLocation: "Cold Room Shelf B2",
        expirationDate: daysFromNow(120),
        status: "Active",
      },
      {
        reagentId: agar.reagentId,
        lotNumber: "TSA-77",
        currentQuantity: 85,
        storageLocation: "Dry Storage C3",
        expirationDate: daysFromNow(15),
        status: "Active",
      },
      {
        reagentId: glycerol.reagentId,
        lotNumber: "GLY-501",
        currentQuantity: 900,
        storageLocation: "Ambient Shelf D1",
        expirationDate: daysFromNow(365),
        status: "Active",
      },
      {
        reagentId: amp.reagentId,
        lotNumber: "AMP-19",
        currentQuantity: 4,
        storageLocation: "Antibiotic Freezer F1",
        expirationDate: daysFromNow(60),
        status: "Active",
      },
    ],
  });

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  await prisma.inventoryTransaction.createMany({
    data: [
      {
        lotId: lot902.lotId,
        userId: "lab-tech-001",
        transactionType: "Check-out",
        quantityChanged: 50,
        experimentIdOrProject: "EXP-101",
        timestamp: new Date(now - 2 * day),
      },
      {
        lotId: lot902.lotId,
        userId: "lab-tech-002",
        transactionType: "Check-out",
        quantityChanged: 100,
        experimentIdOrProject: "EXP-101",
        timestamp: new Date(now - 10 * day),
      },
      {
        lotId: lot902.lotId,
        userId: "lab-tech-001",
        transactionType: "Check-out",
        quantityChanged: 75,
        experimentIdOrProject: "PROJ-MIC-07",
        timestamp: new Date(now - 40 * day),
      },
    ],
  });

  console.log("Seed complete: 3 suppliers, 5 reagents, sample Lot 902 (Ethanol Absolute).");
  console.log("Low-stock candidates: Ampicillin (4 vials), TSA (85g).");
  console.log("Users (password for all: changeme123): admin, lab-tech-001, lab-tech-002");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
