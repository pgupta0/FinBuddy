import { UIMessage } from "ai";
import type { JSONValue } from "ai";
import {
  DEFAULT_VENDOR,
  DEFAULT_MODEL_ID,
  DEFAULT_MODE,
  DEFAULT_THINKING_LEVEL,
  STRONG_REASONING_LENGTH_THRESHOLD,
  CHAT_THINKING_LEVEL,
  MAX_STEPS,
  MAX_STEPS_ECONOMY,
} from "@/config";
import {
  thinkingBudget,
  providerSpec,
  wrapProviderOptions,
  resolveChatModel,
  isSelectable,
  type Vendor,
  type Mode,
  type ThinkingLevel,
} from "@/lib/ai/model-registry";

export type RouteResult = {
  vendor: Vendor;
  modelId: string;
  mode: Mode;
  thinkingLevel: ThinkingLevel;
  /** Tool-use step ceiling for this request — see stepBudgetFor below. */
  maxSteps: number;
};

/**
 * How many tool-use steps this request gets. Every step is its own model
 * call, and on a free-tier vendor's economy model that call draws from the
 * SAME per-day quota the moderation classifier also draws from (see
 * config.ts's MAX_STEPS_ECONOMY comment) — so the cheaper the model, the
 * tighter the budget needs to be to avoid running that quota out mid-day.
 * Paid/standard/premium models keep the full MAX_STEPS budget.
 */
function stepBudgetFor(vendor: Vendor, modelId: string): number {
  const spec = providerSpec(vendor);
  const entry = spec.models.find((m) => m.id === modelId);
  if (spec.freeTier && entry?.tier === "economy") return MAX_STEPS_ECONOMY;
  return MAX_STEPS;
}

/**
 * Vendor-keyed provider options (e.g. `{ anthropic: {...} }`, `{ google: {...} }`).
 * Intentionally open-ended: each vendor's option shape is defined by its entry
 * in lib/ai/providers.ts, not duplicated in this type.
 */
export type RouteProviderOptions = Record<string, Record<string, JSONValue>>;

export function getLatestUserText(messages: UIMessage[]): string {
  const latestUserMessage = messages.filter((m) => m.role === "user").pop();
  if (!latestUserMessage) return "";

  return latestUserMessage.parts
    .filter((p) => p.type === "text")
    .map((p: any) => ("text" in p ? p.text : ""))
    .join("")
    .trim();
}

/**
 * Cues that justify paying for extended reasoning on THIS app.
 *
 * The base template escalated on programming cues (prove, derive, debug this,
 * trace execution, time complexity, stack trace) because it was a template for
 * academic/technical chatbots. None of those fire on a realistic FinBuddy
 * question, while several of its broad triggers ("code", "math", "equation" in
 * any long message) fired on questions that needed no reasoning at all —
 * escalation cost without escalation benefit.
 *
 * These patterns instead match the cases where this assistant genuinely does
 * multi-step work: reconciling a user's own portfolio against a benchmark,
 * working through allocation arithmetic, or comparing several strategies at
 * once. The deterministic flows (risk scoring, fund lookup) do NOT appear here
 * on purpose — they are computed in code, not reasoned about, so they need no
 * thinking budget.
 */
const REASONING_CUES =
  /\b(compare|comparison|versus|vs\.?|trade[- ]?offs?|walk me through|step[- ]by[- ]step|show (?:me )?your work|reconcile|rebalanc\w*|drift\w*|why (?:is|would|does)|how (?:do|does) .{0,40}(?:differ|compare)|allocat\w+ (?:math|calculation)|work(?:ing)? out|overlap)\b/i;

/** Topics where a shallow answer is actively unhelpful, regardless of phrasing. */
const MULTI_DOC_CUES =
  /\b(risk parity|core[- ]satellite|endowment[- ]style|family office|pms|asset allocation strategy)\b/i;

/** What the client asked for, before any validation. Both fields untrusted. */
export type RequestedModel = {
  vendor?: string | null;
  modelId?: string | null;
};

/**
 * Picks vendor, model, mode and thinking level for one request.
 *
 * MODE AND THINKING LEVEL ARE SERVER-SIDE ONLY — a client cannot ask for
 * extended reasoning and run up the bill.
 *
 * VENDOR AND MODEL are server-side by default, but a client MAY request one
 * when the in-app picker is enabled (ENABLE_MODEL_PICKER in config.ts). That
 * request is honoured only if it survives isSelectable(): the model must exist
 * in the catalog in lib/ai/providers.ts AND its vendor's API key must be set.
 * Anything else — an unknown vendor, a model id this deployment cannot serve,
 * a crafted string aimed at the provider API — is silently dropped in favour
 * of the configured default. The client's string is never passed through to
 * createModel() unchecked.
 */
export function routeRequest(
  messages: UIMessage[],
  requested?: RequestedModel
): RouteResult {
  // Resolve against configured keys so the logged/returned vendor is the one
  // that will really serve the request (matters when only a Gemini key is set).
  const fallback = resolveChatModel(DEFAULT_VENDOR, DEFAULT_MODEL_ID);

  const wanted =
    requested?.vendor && requested?.modelId && isSelectable(requested.vendor, requested.modelId)
      ? { vendor: requested.vendor as Vendor, modelId: requested.modelId }
      : null;

  const { vendor, modelId } = wanted ?? fallback;
  let mode: Mode = DEFAULT_MODE;
  let thinkingLevel: ThinkingLevel = DEFAULT_THINKING_LEVEL;

  const latestText = getLatestUserText(messages);

  const escalate =
    REASONING_CUES.test(latestText) ||
    MULTI_DOC_CUES.test(latestText) ||
    latestText.length > STRONG_REASONING_LENGTH_THRESHOLD;

  if (escalate) {
    mode = "reasoning";
    thinkingLevel = "high";
  }

  return { vendor, modelId, mode, thinkingLevel, maxSteps: stepBudgetFor(vendor, modelId) };
}

/**
 * Builds `providerOptions` for the resolved vendor by delegating to that
 * vendor's entry in lib/ai/providers.ts. No vendor names appear here.
 */
export function buildProviderOptions(
  vendor: Vendor,
  mode: Mode,
  thinkingLevel: ThinkingLevel,
  modelId: string = DEFAULT_MODEL_ID
): RouteProviderOptions {
  const level = mode === "reasoning" ? thinkingLevel : CHAT_THINKING_LEVEL;
  const inner = providerSpec(vendor).thinkingOptions({
    modelId,
    level,
    budgetTokens: thinkingBudget(level),
  });
  return wrapProviderOptions(vendor, inner);
}

/**
 * Strips the thinking/reasoning fragment for a turn where a tool call is
 * FORCED. Anthropic rejects `tool_choice: {type:"tool"}` while extended
 * thinking is enabled ("Thinking may not be enabled when tool_choice forces
 * tool use.") — a hard 400 that broke every matched request in production.
 * Vendors that tolerate the combination are left untouched, so they keep their
 * reasoning on the forced turn.
 */
export function providerOptionsForForcedTool(
  vendor: Vendor,
  providerOptions: RouteProviderOptions
): RouteProviderOptions {
  if (!providerSpec(vendor).forcedToolChoiceConflictsWithThinking) {
    return providerOptions;
  }
  const key = providerSpec(vendor).providerKey;
  const { [key]: _dropped, ...rest } = providerOptions;
  return rest;
}
