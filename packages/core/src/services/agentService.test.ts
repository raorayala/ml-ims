import { describe, expect, it } from "vitest";
import { parseNaturalLanguage } from "./agentService.js";

describe("parseNaturalLanguage", () => {
  it("parses check-out with lot, quantity, and project", () => {
    const action = parseNaturalLanguage(
      "I took 50mL of Lot 902 for Project EXP-101",
      "lab-tech-001",
    );
    expect(action).toEqual({
      tool: "check_out_reagent",
      args: {
        lotNumber: "902",
        quantity: 50,
        userId: "lab-tech-001",
        experimentIdOrProject: "EXP-101",
      },
    });
  });

  it("parses check-in", () => {
    const action = parseNaturalLanguage("Check in 25 of lot ETH-881", "u1");
    expect(action.tool).toBe("check_in_reagent");
    if (action.tool === "check_in_reagent") {
      expect(action.args.lotNumber).toBe("ETH-881");
      expect(action.args.quantity).toBe(25);
    }
  });

  it("parses evaluate thresholds", () => {
    const action = parseNaturalLanguage("Evaluate thresholds", "u1");
    expect(action).toEqual({ tool: "evaluate_thresholds", args: {} });
  });

  it("parses consumption report", () => {
    const action = parseNaturalLanguage(
      "Show 30 day consumption by project",
      "u1",
    );
    expect(action).toEqual({
      tool: "get_consumption_report",
      args: { days: 30, groupBy: "project" },
    });
  });

  it("throws on unknown phrases", () => {
    expect(() => parseNaturalLanguage("hello lab", "u1")).toThrow(/Could not parse/);
  });
});
