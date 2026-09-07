export type MatterRisk = "NEUTRAL" | "GREEN" | "YELLOW" | "RED";
export type RiskThresholds = Readonly<{ criticalDays: number; warningDays: number }>;

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = Object.freeze({
  criticalDays: 2,
  warningDays: 7,
});

/** Input is calendar-day distance in the firm's timezone for OPEN commitments only.
 * Date conversion and excluding closed events/tasks belong to the read model.
 * This is operational urgency, not a calculation of procedural deadlines.
 */
export function deriveMatterRisk(
  commitmentDays: readonly number[],
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
): MatterRisk {
  const { criticalDays, warningDays } = thresholds;
  if (!Number.isSafeInteger(criticalDays) || !Number.isSafeInteger(warningDays)
    || criticalDays < 0 || warningDays <= criticalDays) {
    throw new Error("INVALID_RISK_THRESHOLDS");
  }
  let nearest = Infinity;
  for (const day of commitmentDays) {
    if (!Number.isSafeInteger(day)) throw new Error("INVALID_COMMITMENT_DAY");
    nearest = Math.min(nearest, day);
  }
  if (nearest === Infinity) return "NEUTRAL";
  if (nearest <= criticalDays) return "RED";
  if (nearest <= warningDays) return "YELLOW";
  return "GREEN";
}
