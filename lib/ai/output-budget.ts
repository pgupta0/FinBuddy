import type { JSONValue } from "ai";

/** Include explicit thinking tokens without hard-coding vendor names.
 * This caps each generation step, not the whole tool loop or session. */
export function outputTokenLimit(
  allowance: number,
  options: Record<string, Record<string, JSONValue>>,
): number {
  let thinking = 0;
  for (const option of Object.values(options)) {
    for (const key of ["thinking", "thinkingConfig"]) {
      const value = option[key];
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const budget = value.budgetTokens ?? value.thinkingBudget;
      if (typeof budget === "number" && Number.isFinite(budget) && budget > 0) {
        thinking = Math.max(thinking, budget);
      }
    }
  }
  return allowance + thinking;
}
