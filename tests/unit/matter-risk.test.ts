import { describe, expect, it } from "vitest";
import { deriveMatterRisk } from "../../src/modules/matters/domain/risk";

describe("operational matter urgency", () => {
  it.each([
    [[], "NEUTRAL"], [[-1], "RED"], [[0], "RED"], [[1], "RED"], [[2], "RED"],
    [[3], "YELLOW"], [[7], "YELLOW"], [[8], "GREEN"],
    [[30, 7, -2], "RED"],
  ] as const)("derives %j as %s", (days, risk) => {
    expect(deriveMatterRisk(days)).toBe(risk);
  });
  it("uses firm-specific thresholds including a zero-day critical window", () => {
    expect(deriveMatterRisk([1], { criticalDays: 0, warningDays: 3 })).toBe("YELLOW");
    expect(deriveMatterRisk([4], { criticalDays: 0, warningDays: 3 })).toBe("GREEN");
  });
  it.each([
    { criticalDays: -1, warningDays: 7 },
    { criticalDays: 7, warningDays: 7 },
    { criticalDays: 2, warningDays: 1 },
    { criticalDays: 0.5, warningDays: 7 },
  ])("rejects invalid firm settings %j", (thresholds) => {
    expect(() => deriveMatterRisk([], thresholds)).toThrow("INVALID_RISK_THRESHOLDS");
  });
  it.each([NaN, Infinity, 1.5])("rejects invalid day distance %s", (value) => {
    expect(() => deriveMatterRisk([value])).toThrow("INVALID_COMMITMENT_DAY");
  });
});
