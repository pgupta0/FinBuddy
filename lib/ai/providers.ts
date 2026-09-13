// lib/ai/providers.ts
//
// SINGLE SOURCE OF TRUTH for LLM vendors.
//
// Everything vendor-specific lives in the PROVIDERS table below: the model
// catalog, the API-key env var, how "thinking" is configured, how background
// (utility) calls are made cheap, and whether prompt caching is supported.
// Adding a vendor means adding one entry here — no edits to routing.ts,
// lib/env.ts, moderation, or compaction.
//
// Why this replaces the base template's approach: the original
// model-registry.ts hardcoded `if (vendor === "anthropic") ... if (vendor ===
// "openai") ...` in three separate places (model creation, chat provider
// options, utility provider options), and routing.ts duplicated the same
// branching in its RouteProviderOptions type. Adding Gemini under that design
// meant touching five files and was easy to get half-done.

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { fireworks } from "@ai-sdk/fireworks";
import type { LanguageModel, JSONValue } from "ai";

export type Vendor = "anthropic" | "openai" | "google" | "fireworks";
export type Mode = "chat" | "reasoning";
export type ThinkingLevel = "off" | "low" | "medium" | "high";

/** Rough cost/capability tier, used by routing to pick a cheap model for cheap work. */
export type Tier = "economy" | "standard" | "premium";

export type ModelEntry = {
  id: string;
  label: string;
  mode: Mode | "both";
  tier: Tier;
};

export type ThinkingArgs = {
  modelId: string;
  level: ThinkingLevel;
  /** Token budget for vendors that take an explicit number. */
  budgetTokens: number;
};

export type VendorSpec = {
  id: Vendor;
  label: string;
  /** Key under which this vendor reads its options out of `providerOptions`. */
  providerKey: string;
  /** Env var that must be present for this vendor to work at all. */
  envKey: string;
  /** True when the vendor offers a no-payment-details free tier (informational). */
  freeTier: boolean;
  models: ModelEntry[];
  /** Model used when this vendor answers chat requests. */
  defaultModelId: string;
  /** Small/fast model for background work (moderation classifier, summaries). */
  defaultUtilityModelId: string;
  create: (modelId: string) => LanguageModel;
  /**
   * Options fragment for a chat/reasoning request. Return {} to send nothing.
   * The returned object is the INNER value — the caller wraps it under
   * `providerKey`.
   */
  thinkingOptions: (a: ThinkingArgs) => Record<string, JSONValue>;
  /** Inner options fragment that makes a background call as fast as possible. */
  utilityOptions: (modelId: string) => Record<string, JSONValue>;
  /**
   * Some vendors reject a forced tool_choice while extended thinking is on
   * (Anthropic returns a hard 400). The chat route strips thinking for that
   * turn when this is true. See app/api/chat/route.ts.
   */
  forcedToolChoiceConflictsWithThinking: boolean;
  /** Whether an explicit cache-control marker on the system prompt is honored. */
  supportsPromptCaching: boolean;
  /**
   * Inner options marking a message as cacheable, for vendors with explicit
   * caching. Omit when supportsPromptCaching is false.
   */
  cacheControlOptions?: (ttl: "5m" | "1h") => Record<string, JSONValue>;
};

// --- Anthropic ---------------------------------------------------------------

// Thinking config differs by model generation:
//   Haiku 4.5 and older  -> explicit { type: "enabled", budgetTokens }
//   4.6 / 5 family       -> { type: "adaptive" }; budgetTokens is REJECTED (400)
//   Fable / Mythos       -> thinking always on; the parameter must be omitted
function anthropicThinking({
  modelId,
  budgetTokens,
}: ThinkingArgs): Record<string, JSONValue> {
  if (modelId.includes("fable") || modelId.includes("mythos")) return {};
  if (/(opus-5|opus-4-[678]|sonnet-5|sonnet-4-6)/.test(modelId)) {
    return { thinking: { type: "adaptive" } };
  }
  return { thinking: { type: "enabled", budgetTokens } };
}

const ANTHROPIC: VendorSpec = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  providerKey: "anthropic",
  envKey: "ANTHROPIC_API_KEY",
  freeTier: false,
  defaultModelId: "claude-haiku-4-5",
  defaultUtilityModelId: "claude-haiku-4-5",
  models: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", mode: "both", tier: "economy" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", mode: "both", tier: "standard" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", mode: "both", tier: "standard" },
  ],
  create: (modelId) => anthropic(modelId),
  thinkingOptions: anthropicThinking,
  utilityOptions: (modelId): Record<string, JSONValue> =>
    modelId.includes("fable") || modelId.includes("mythos")
      ? {} // thinking cannot be disabled on these
      : { thinking: { type: "disabled" } },
  forcedToolChoiceConflictsWithThinking: true,
  supportsPromptCaching: true,
  // "5m" is Anthropic's default TTL and needs no parameter; "1h" is opt-in and
  // costs more to write, so it is only sent when asked for.
  cacheControlOptions: (ttl): Record<string, JSONValue> => ({
    cacheControl: { type: "ephemeral", ...(ttl === "1h" ? { ttl: "1h" } : {}) },
  }),
};

// --- OpenAI ------------------------------------------------------------------

function openaiEffort(level: ThinkingLevel) {
  switch (level) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    default:
      return "minimal";
  }
}

const OPENAI: VendorSpec = {
  id: "openai",
  label: "OpenAI (GPT)",
  providerKey: "openai",
  envKey: "OPENAI_API_KEY",
  freeTier: false,
  defaultModelId: "gpt-5.6-luna",
  defaultUtilityModelId: "gpt-5.4-mini",
  models: [
    { id: "gpt-5.6-luna", label: "GPT-5.6 Luna (economy)", mode: "both", tier: "economy" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", mode: "both", tier: "economy" },
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra (mid-tier)", mode: "both", tier: "standard" },
  ],
  // .responses() is the Responses API surface, which is what supports
  // reasoningSummary on the reasoning-capable models.
  create: (modelId) => openai.responses(modelId),
  thinkingOptions: ({ level }): Record<string, JSONValue> => ({
    reasoningSummary: "auto",
    reasoningEffort: openaiEffort(level),
    parallelToolCalls: false,
  }),
  utilityOptions: () => ({ reasoningEffort: "minimal" }),
  // OpenAI accepts a forced tool choice alongside reasoning.
  forcedToolChoiceConflictsWithThinking: false,
  // OpenAI caches long prefixes automatically; no marker to send.
  supportsPromptCaching: false,
};

// --- Google Gemini -----------------------------------------------------------

// Gemini splits thinking config by generation:
//   Gemini 3.x  -> thinkingConfig.thinkingLevel: "low" | "high"
//   Gemini 2.5  -> thinkingConfig.thinkingBudget: <tokens>
// Sending the wrong one for a generation is ignored at best and an error at
// worst, so branch on the model id rather than guessing.
function geminiThinking({
  modelId,
  level,
  budgetTokens,
}: ThinkingArgs): Record<string, JSONValue> {
  const isGemini3 = /gemini-3/.test(modelId);

  if (level === "off") {
    // 2.5 can be told not to think at all; 3.x has no "off", so ask for the
    // smallest amount instead.
    return isGemini3
      ? { thinkingConfig: { thinkingLevel: "low" } }
      : { thinkingConfig: { thinkingBudget: 0 } };
  }

  if (isGemini3) {
    return {
      thinkingConfig: {
        thinkingLevel: level === "high" ? "high" : "low",
        includeThoughts: true,
      },
    };
  }

  return { thinkingConfig: { thinkingBudget: budgetTokens, includeThoughts: true } };
}

const GOOGLE: VendorSpec = {
  id: "google",
  label: "Google (Gemini)",
  providerKey: "google",
  envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
  // The one vendor here with a genuinely free tier (AI Studio key, no card).
  // Free-tier quotas are per-minute AND per-day and are easy to exhaust, which
  // is why PROVIDER_FALLBACK_ORDER in config.ts matters when Gemini is primary.
  // Defaults point at the STABLE 2.5 line, not the 3.5 preview line — 3.5's
  // free tier caps out at just 20 requests/day per model project-wide and was
  // exhausted almost instantly in production (see config.ts DEFAULT_MODEL_ID).
  freeTier: true,
  defaultModelId: "gemini-2.5-flash",
  defaultUtilityModelId: "gemini-2.5-flash",
  models: [
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite", mode: "both", tier: "economy" },
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", mode: "both", tier: "economy" },
    { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", mode: "both", tier: "standard" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (stable)", mode: "both", tier: "economy" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", mode: "both", tier: "premium" },
  ],
  create: (modelId) => google(modelId),
  thinkingOptions: geminiThinking,
  utilityOptions: (modelId): Record<string, JSONValue> =>
    /gemini-3/.test(modelId)
      ? { thinkingConfig: { thinkingLevel: "low" } }
      : { thinkingConfig: { thinkingBudget: 0 } },
  forcedToolChoiceConflictsWithThinking: false,
  // Gemini caches implicitly on long repeated prefixes; explicit caching uses a
  // separate cached-content API that is not wired up here.
  supportsPromptCaching: false,
};

// --- Fireworks (open-source models) -----------------------------------------

const FIREWORKS: VendorSpec = {
  id: "fireworks",
  label: "Fireworks (open models)",
  providerKey: "fireworks",
  envKey: "FIREWORKS_API_KEY",
  freeTier: false,
  defaultModelId: "accounts/fireworks/models/deepseek-v4-pro",
  defaultUtilityModelId: "accounts/fireworks/models/kimi-k2p6",
  models: [
    {
      id: "accounts/fireworks/models/deepseek-v4-pro",
      label: "DeepSeek V4 Pro",
      mode: "chat",
      tier: "standard",
    },
    {
      id: "accounts/fireworks/models/deepseek-r1",
      label: "DeepSeek R1",
      mode: "reasoning",
      tier: "standard",
    },
    {
      id: "accounts/fireworks/models/kimi-k2p6",
      label: "Kimi K2.6",
      mode: "chat",
      tier: "economy",
    },
  ],
  create: (modelId) => fireworks(modelId),
  thinkingOptions: () => ({}),
  utilityOptions: () => ({}),
  forcedToolChoiceConflictsWithThinking: false,
  supportsPromptCaching: false,
};

// --- Registry ----------------------------------------------------------------

export const PROVIDERS: Record<Vendor, VendorSpec> = {
  anthropic: ANTHROPIC,
  openai: OPENAI,
  google: GOOGLE,
  fireworks: FIREWORKS,
};

export const ALL_VENDORS = Object.keys(PROVIDERS) as Vendor[];

export function providerSpec(vendor: Vendor): VendorSpec {
  const spec = PROVIDERS[vendor];
  if (!spec) throw new Error(`Unknown vendor "${vendor}".`);
  return spec;
}

/** True when this vendor's API key is present in the environment. */
export function isVendorConfigured(vendor: Vendor): boolean {
  const key = process.env[providerSpec(vendor).envKey];
  return typeof key === "string" && key.trim().length > 0;
}

export function configuredVendors(): Vendor[] {
  return ALL_VENDORS.filter(isVendorConfigured);
}

/** Every model id this vendor offers, for validating config at startup. */
export function vendorHasModel(vendor: Vendor, modelId: string): boolean {
  return providerSpec(vendor).models.some((m) => m.id === modelId);
}

/** Builds the model handle for a vendor + model id. */
export function createModel(vendor: Vendor, modelId: string): LanguageModel {
  return providerSpec(vendor).create(modelId);
}

/**
 * Wraps a vendor's inner options fragment under its provider key, dropping it
 * entirely when empty (sending `{ anthropic: {} }` is not the same as sending
 * nothing on some models).
 */
/**
 * Provider options that mark a message as cacheable, or `{}` when this vendor
 * has no explicit caching (OpenAI and Gemini cache long prefixes on their own,
 * so there is nothing to send and nothing to fail).
 */
export function promptCacheOptions(
  vendor: Vendor,
  ttl: "5m" | "1h"
): Record<string, Record<string, JSONValue>> {
  const spec = providerSpec(vendor);
  if (!spec.supportsPromptCaching || !spec.cacheControlOptions) return {};
  return wrapProviderOptions(vendor, spec.cacheControlOptions(ttl));
}

export function wrapProviderOptions(
  vendor: Vendor,
  inner: Record<string, JSONValue>
): Record<string, Record<string, JSONValue>> {
  if (Object.keys(inner).length === 0) return {};
  return { [providerSpec(vendor).providerKey]: inner };
}
