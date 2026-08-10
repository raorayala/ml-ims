import { describe, expect, it } from "vitest";
import { CheckOutInput, ReagentInput, SupplierInput } from "./index.js";

describe("shared validation schemas", () => {
  it("accepts valid check-out by lot number", () => {
    const parsed = CheckOutInput.parse({
      lotNumber: "902",
      quantity: 10,
      userId: "lab-tech-001",
      experimentIdOrProject: "EXP-101",
    });
    expect(parsed.quantity).toBe(10);
  });

  it("rejects check-out without lot identity", () => {
    expect(() =>
      CheckOutInput.parse({
        quantity: 10,
        userId: "lab-tech-001",
      }),
    ).toThrow();
  });

  it("validates supplier email", () => {
    expect(() =>
      SupplierInput.parse({
        supplierName: "Acme",
        contactEmail: "not-an-email",
        contactPhone: "1",
        accountNumber: "A1",
      }),
    ).toThrow();
  });

  it("validates reagent units", () => {
    const parsed = ReagentInput.parse({
      reagentName: "Buffer",
      unitOfMeasure: "mL",
      minThresholdQuantity: 1,
      reorderQuantity: 10,
      supplierId: "11111111-1111-1111-1111-111111111111",
    });
    expect(parsed.unitOfMeasure).toBe("mL");
  });
});
