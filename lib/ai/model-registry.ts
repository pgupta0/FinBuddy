// lib/ai/model-registry.ts
//
// Thin layer over lib/ai/providers.ts. The vendor TABLE lives there; this file
// only resolves config.ts settings into concrete model handles, and owns the
// one piece of policy that is not vendor-specific: what happens when the
// configured vendor has no API key.
//
// Kept as a separate module (rather than folded into providers.ts) so the
// call sites that only ever wanted "give me the chat model" / "give me the
// utility model" — route.ts, lib/moderation.ts, lib/compaction.ts — do not
// need to know the registry exists.

import type { JSONValue } from "ai";
import {
  PROVIDERS,
  ALL_VENDORS,
  providerSpec,
  isVendorConfigured,
  configuredVendors,
  createModel,
  wrapProviderOptions,
  promptCacheOptions,
  vendorHasModel,
  type Vendor,
  type Mode,
  type ThinkingLevel,
  type ModelEntry,
  type Tier,
} from "@/lib/ai/providers";
import {
  THINKING_BUDGET_LOW,
  THINKING_BUDGET_MEDIUM,
  THINKING_BUDGET_HIGH,
  DEFAULT_VENDOR,
  DEFAULT_MODEL_ID,
  UTILITY_VENDOR,
  UTILITY_MODEL_ID,
  PROVIDER_FALLBACK_ORDER,
} from "@/config";

export type { Vendor, Mode, ThinkingLevel, ModelEntry, Tier };
export {
  PROVIDERS,
  ALL_VENDORS,
  providerSpec,
  isVendorConfigured,
  configuredVendors,
  vendorHasModel,
  wrapProviderOptions,
  promptCacheOptions,
};

/**
 * The model catalog, by vendor. Exported for the admin-facing docs and for
 * startup validation — end users never choose a model (see routing.ts).
 */
export const MODEL_OPTIONS: Record<Vendor, ModelEntry[]> = Object.fromEntries(
  ALL_VENDORS.map((v) => [v, PROVIDERS[v].models])
) as Record<Vendor, ModelEntry[]>;

// --- Vendor resolution ------------------------------------------------------

/**
 * Resolves which vendor actually serves a request.
 *
 * The configured vendor wins whenever its key is present. When it is not, the
 * first configured vendor in PROVIDER_FALLBACK_ORDER serves instead, so a
 * deployment with only a Gemini key runs without editing config.ts, and a
 * missing key degrades to a working app rather than a boot crash.
 *
 * NOTE ON SCOPE — this is per-request *resolution*, not mid-stream failover. If
 * the chosen vendor accepts the request and then rate-limits or errors
 * mid-stream, that request fails; it is not silently retried on another vendor.
 * Retrying a partially streamed answer on a different model would produce a
 * visibly spliced response, so it is deliberately not attempted.
 */
export function resolveVendor(preferred: Vendor): {
  vendor: Vendor;
  fellBack: boolean;
} {
  if (isVendorConfigured(preferred)) return { vendor: preferred, fellBack: false };

  for (const candidate of PROVIDER_FALLBACK_ORDER) {
    if (candidate !== preferred && isVendorConfigured(candidate)) {
      return { vendor: candidate, fellBack: true };
    }
  }

  const anyConfigured = configuredVendors()[0];
  if (anyConfigured) return { vendor: anyConfigured, fellBack: true };

  // Nothing configured at all. lib/env.ts already refuses to boot in this
  // state, so the app never serves a request from here — but this function is
  // also called from pure routing logic (and from tests), so it returns the
  // preferred vendor rather than throwing. The real failure then comes from the
  // provider SDK, with an accurate message about the missing key, instead of
  // from routing with a misleading one.
  return { vendor: preferred, fellBack: false };
}

/**
 * A model id valid for `vendor`. When falling back to a different vendor, the
 * configured model id belongs to the old vendor and cannot be reused, so that
 * vendor's own default is used instead.
 */
function modelIdFor(vendor: Vendor, requested: string): string {
  if (vendorHasModel(vendor, requested)) return requested;
  return providerSpec(vendor).defaultModelId;
}

// --- Chat model -------------------------------------------------------------

export function getModel(vendor: Vendor, modelId: string) {
  const { vendor: resolved, fellBack } = resolveVendor(vendor);
  const resolvedModelId = modelIdFor(resolved, modelId);
  if (fellBack) {
    console.warn(
      `PROVIDER: "${vendor}" is not configured (${providerSpec(vendor).envKey} unset) — serving with "${resolved}" / ${resolvedModelId}.`
    );
  }
  return createModel(resolved, resolvedModelId);
}

/** The vendor/model a chat request will actually use, for provider options. */
export function resolveChatModel(
  vendor: Vendor = DEFAULT_VENDOR,
  modelId: string = DEFAULT_MODEL_ID
): { vendor: Vendor; modelId: string } {
  const { vendor: resolved } = resolveVendor(vendor);
  return { vendor: resolved, modelId: modelIdFor(resolved, modelId) };
}

// --- Utility model (moderation classifier, compaction summaries) ------------

function resolveUtilityModel(): { vendor: Vendor; modelId: string } {
  const { vendor } = resolveVendor(UTILITY_VENDOR);
  const modelId = vendorHasModel(vendor, UTILITY_MODEL_ID)
    ? UTILITY_MODEL_ID
    : providerSpec(vendor).defaultUtilityModelId;
  return { vendor, modelId };
}

export function getUtilityModel() {
  const { vendor, modelId } = resolveUtilityModel();
  return createModel(vendor, modelId);
}

/** Provider options that make background work as fast and cheap as the vendor allows. */
export function utilityProviderOptions(): Record<string, Record<string, JSONValue>> {
  const { vendor, modelId } = resolveUtilityModel();
  return wrapProviderOptions(vendor, providerSpec(vendor).utilityOptions(modelId));
}

// --- Thinking budgets -------------------------------------------------------

export function thinkingBudget(level: ThinkingLevel): number {
  switch (level) {
    case "low":
      return THINKING_BUDGET_LOW;
    case "medium":
      return THINKING_BUDGET_MEDIUM;
    case "high":
      return THINKING_BUDGET_HIGH;
    default:
      return 0;
  }
}
