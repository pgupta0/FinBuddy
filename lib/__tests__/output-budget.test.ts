import { describe, it, expect } from "vitest";
import { THINKING_BUDGET_HIGH } from "@/config";
import { outputTokenLimit } from "@/lib/ai/output-budget";
import { buildProviderOptions, providerOptionsForForcedTool } from "@/lib/ai/routing";

describe("per-step output budget", () => {
  it("caps generation when explicit thinking is absent", () => {
    expect(outputTokenLimit(4000, {})).toBe(4000);
  });
  it("leaves room for an explicit thinking budget and the answer", () => {
    const options = buildProviderOptions("anthropic", "reasoning", "high", "claude-haiku-4-5");
    expect(outputTokenLimit(4000, options)).toBe(4000 + THINKING_BUDGET_HIGH);
  });
  it("does not reserve tokens for thinking removed on a forced tool step", () => {
    const options = buildProviderOptions("anthropic", "chat", "low", "claude-haiku-4-5");
    expect(outputTokenLimit(4000, providerOptionsForForcedTool("anthropic", options))).toBe(4000);
  });
  it("supports numeric Gemini thinking budgets", () => {
    expect(outputTokenLimit(4000, { google: { thinkingConfig: { thinkingBudget: 2000 } } })).toBe(6000);
  });
  it("caps adaptive or level-based thinking within the allowance", () => {
    expect(outputTokenLimit(4000, { provider: { thinking: { type: "adaptive" } } })).toBe(4000);
  });
  it("ignores disabled and invalid budgets", () => {
    expect(outputTokenLimit(4000, { provider: { thinking: { budgetTokens: -1 }, thinkingConfig: null } })).toBe(4000);
  });
});
