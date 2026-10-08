import { describe, it, expect } from "vitest";
import {
  routeRequest,
  getLatestUserText,
  buildProviderOptions,
  providerOptionsForForcedTool,
} from "@/lib/ai/routing";
import { UIMessage } from "ai";

function makeMessages(text: string): UIMessage[] {
  return [
    {
      id: "1",
      role: "user",
      parts: [{ type: "text", text }],
    },
  ];
}

describe("getLatestUserText", () => {
  it("extracts text from latest user message", () => {
    const messages: UIMessage[] = [
      { id: "1", role: "user", parts: [{ type: "text", text: "first" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "reply" }] },
      { id: "3", role: "user", parts: [{ type: "text", text: "second" }] },
    ];
    expect(getLatestUserText(messages)).toBe("second");
  });

  it("returns empty string when no user messages", () => {
    const messages: UIMessage[] = [
      { id: "1", role: "assistant", parts: [{ type: "text", text: "hi" }] },
    ];
    expect(getLatestUserText(messages)).toBe("");
  });

  it("returns empty string for empty array", () => {
    expect(getLatestUserText([])).toBe("");
  });
});

// Escalation cues are domain-specific by design. The base template escalated on
// programming cues (prove / derive / debug this / time complexity), which never
// fire on a realistic FinBuddy question, while its broad "long message mentioning
// code or math" trigger fired on questions needing no reasoning at all. These
// tests pin the replacement behaviour: escalate on genuine multi-step financial
// reasoning, stay in chat mode for lookups.
describe("routeRequest", () => {
  it("defaults to chat mode for simple queries", () => {
    const result = routeRequest(makeMessages("What is an expense ratio?"));
    expect(result.mode).toBe("chat");
    // DEFAULT_VENDOR in config.ts — currently "google" (Gemini). No provider
    // key is set in the test environment, so resolveVendor() returns the
    // configured default unchanged rather than falling back to anything else.
    expect(result.vendor).toBe("google");
  });

  it("stays in chat mode for a plain glossary lookup", () => {
    expect(routeRequest(makeMessages("what does NAV mean")).mode).toBe("chat");
  });

  it("escalates when the user asks for a comparison", () => {
    const result = routeRequest(
      makeMessages("compare a direct plan with a regular plan for me")
    );
    expect(result.mode).toBe("reasoning");
    expect(result.thinkingLevel).toBe("high");
  });

  it("escalates on trade-off questions", () => {
    expect(
      routeRequest(makeMessages("what are the trade-offs of a hybrid fund")).mode
    ).toBe("reasoning");
  });

  it("escalates on portfolio drift and rebalancing", () => {
    expect(
      routeRequest(makeMessages("how much has my allocation drifted since March"))
        .mode
    ).toBe("reasoning");
    expect(routeRequest(makeMessages("should I rebalance my portfolio")).mode).toBe(
      "reasoning"
    );
  });

  it("escalates on named strategy frameworks", () => {
    expect(routeRequest(makeMessages("explain risk parity")).mode).toBe(
      "reasoning"
    );
    expect(
      routeRequest(makeMessages("what is a core-satellite approach")).mode
    ).toBe("reasoning");
  });

  it("escalates on step-by-step and show-your-work requests", () => {
    expect(
      routeRequest(makeMessages("walk me through how SIP returns are computed"))
        .mode
    ).toBe("reasoning");
    expect(
      routeRequest(makeMessages("show your work for this calculation")).mode
    ).toBe("reasoning");
  });

  it("escalates for unusually long messages regardless of wording", () => {
    const long = "I have some savings and I am not sure what to do. ".repeat(50);
    expect(routeRequest(makeMessages(long)).mode).toBe("reasoning");
  });

  it("does not escalate for general questions", () => {
    expect(routeRequest(makeMessages("Tell me about mutual funds")).mode).toBe(
      "chat"
    );
  });

  it("no longer escalates on programming cues", () => {
    expect(
      routeRequest(makeMessages("prove that this algorithm is O(n log n)")).mode
    ).toBe("chat");
    expect(routeRequest(makeMessages("debug this function")).mode).toBe("chat");
  });
});

describe("buildProviderOptions", () => {
  it("enables thinking for anthropic reasoning mode", () => {
    const opts = buildProviderOptions(
      "anthropic",
      "reasoning",
      "high",
      "claude-haiku-4-5"
    );
    expect((opts.anthropic as any)?.thinking.type).toBe("enabled");
    expect((opts.anthropic as any)?.thinking.budgetTokens).toBe(15000);
  });

  it("enables low thinking budget for anthropic chat mode", () => {
    const opts = buildProviderOptions(
      "anthropic",
      "chat",
      "medium",
      "claude-haiku-4-5"
    );
    expect((opts.anthropic as any)?.thinking.type).toBe("enabled");
    expect((opts.anthropic as any)?.thinking.budgetTokens).toBe(2000);
  });

  it("sends adaptive thinking for anthropic models that reject budgets", () => {
    const opts = buildProviderOptions(
      "anthropic",
      "reasoning",
      "high",
      "claude-sonnet-5"
    );
    expect((opts.anthropic as any)?.thinking.type).toBe("adaptive");
    expect((opts.anthropic as any)?.thinking.budgetTokens).toBeUndefined();
  });

  // BEHAVIOUR CHANGE from the base template, and deliberate: the template
  // applied CHAT_THINKING_LEVEL in chat mode for Anthropic but passed the
  // routed thinkingLevel straight through for OpenAI, so an OpenAI deployment
  // silently paid for "medium" reasoning on every plain chat turn while an
  // Anthropic one paid for "low". Chat mode now means CHAT_THINKING_LEVEL for
  // every vendor; the routed level applies in reasoning mode.
  it("uses CHAT_THINKING_LEVEL for openai in chat mode", () => {
    const opts = buildProviderOptions("openai", "chat", "medium", "gpt-5.6-luna");
    expect((opts.openai as any)?.reasoningEffort).toBe("low");
  });

  it("uses the routed level for openai in reasoning mode", () => {
    const opts = buildProviderOptions(
      "openai",
      "reasoning",
      "medium",
      "gpt-5.6-luna"
    );
    expect((opts.openai as any)?.reasoningEffort).toBe("medium");
  });

  it("uses thinkingLevel for Gemini 3 and thinkingBudget for Gemini 2.5", () => {
    const g3 = buildProviderOptions(
      "google",
      "reasoning",
      "high",
      "gemini-3.6-flash"
    );
    expect((g3.google as any)?.thinkingConfig.thinkingLevel).toBe("high");
    expect((g3.google as any)?.thinkingConfig.thinkingBudget).toBeUndefined();

    const g25 = buildProviderOptions(
      "google",
      "reasoning",
      "high",
      "gemini-2.5-flash"
    );
    expect((g25.google as any)?.thinkingConfig.thinkingBudget).toBe(15000);
    expect((g25.google as any)?.thinkingConfig.thinkingLevel).toBeUndefined();
  });

  it("returns empty options for fireworks", () => {
    const opts = buildProviderOptions(
      "fireworks",
      "chat",
      "medium",
      "accounts/fireworks/models/kimi-k2p6"
    );
    expect(Object.keys(opts)).toHaveLength(0);
  });
});

// Anthropic rejects a forced tool_choice while extended thinking is enabled
// (a hard 400). Vendors that tolerate the combination must keep their options.
describe("providerOptionsForForcedTool", () => {
  it("strips the thinking fragment for anthropic", () => {
    const opts = buildProviderOptions(
      "anthropic",
      "chat",
      "low",
      "claude-haiku-4-5"
    );
    expect(opts.anthropic).toBeDefined();
    expect(
      providerOptionsForForcedTool("anthropic", opts).anthropic
    ).toBeUndefined();
  });

  it("leaves google and openai options untouched", () => {
    const g = buildProviderOptions("google", "chat", "low", "gemini-3.6-flash");
    expect(providerOptionsForForcedTool("google", g).google).toEqual(g.google);

    const o = buildProviderOptions("openai", "chat", "low", "gpt-5.6-luna");
    expect(providerOptionsForForcedTool("openai", o).openai).toEqual(o.openai);
  });
});
