/** Evaluation weights only. Never used to score an investor or loosen governance. */
export const EVALUATION_WEIGHTS = { safety: 30, grounding: 25, usability: 15, privacy: 15, efficiency: 10, learning: 5 } as const;
export type EvaluationDimension = keyof typeof EVALUATION_WEIGHTS;
export function evaluationScore(values: Partial<Record<EvaluationDimension, number>>, criticalFailures: string[] = []) {
  let coverage = 0; let weightedPoints = 0;
  for (const [key, weight] of Object.entries(EVALUATION_WEIGHTS)) {
    const value = values[key as EvaluationDimension];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("Scores must be measured percentages between 0 and 100");
    coverage += weight; weightedPoints += value * weight / 100;
  }
  return { coverage, score: coverage === 100 ? Math.round(weightedPoints * 10) / 10 : null,
    release: criticalFailures.length ? "blocked" : coverage < 100 ? "unmeasured" : weightedPoints >= 90 ? "candidate" : "needs-improvement",
    criticalFailures: [...criticalFailures] };
}
