import { z } from "zod";
import {
  ALL_VENDORS,
  providerSpec,
  isVendorConfigured,
  configuredVendors,
  vendorHasModel,
} from "@/lib/ai/providers";
import {
  DEFAULT_VENDOR,
  DEFAULT_MODEL_ID,
  UTILITY_VENDOR,
  UTILITY_MODEL_ID,
  PROVIDER_FALLBACK_ORDER,
  MODERATION_PROVIDER,
  ENABLE_VECTOR_SEARCH,
  ENABLE_WEB_SEARCH,
} from "@/config";

/**
 * Server-side environment validation. Called lazily by ensureEnv() at the
 * start of the /api/chat request handler — NOT at module import time.
 *
 * That distinction matters and is not cosmetic: this module was previously
 * imported for its side effect (`import "@/lib/env"`), with validation
 * running as soon as the module loaded via a top-level `export const env =
 * validateEnv()`. Next.js's production build ("next build") evaluates route
 * modules during its "Collecting page data" step to gather route metadata —
 * so that eager validation ran DURING THE BUILD, not just at request time.
 * Any env mismatch between the build environment and the intended runtime
 * configuration (a key added to only one Vercel environment, a var renamed,
 * a temporary gap while rotating a key) turned into a hard build failure,
 * which takes down deployment of every route, not just /api/chat — the whole
 * site 404s until the next successful build. Validating lazily means a
 * misconfiguration is still caught loudly and immediately, but only when an
 * actual request needs it, and it can never fail a build.
 *
 * WHAT CHANGED FROM THE BASE TEMPLATE, AND WHY:
 * the template required ANTHROPIC_API_KEY unconditionally and threw on import
 * without it. That made "run this on a free Gemini key" impossible — the app
 * would not boot at all, regardless of config.ts. The rule is now
 * "at least one provider must be usable", with everything else checked against
 * what the configuration actually asks for:
 *
 *   - at least one vendor in lib/ai/providers.ts has its key set
 *   - if DEFAULT_VENDOR's key is missing, a fallback exists (warn, don't throw)
 *   - keys required by the ENABLED features are present (Pinecone, Exa,
 *     OpenAI-for-moderation) — those throw, because silently losing the
 *     knowledge base is worse than failing loudly at startup
 *   - configured model ids actually exist in the catalog
 */

// Per-vendor keys are validated against the provider registry, not listed here,
// so adding a vendor to lib/ai/providers.ts needs no edit in this file.
const envSchema = z.object({
  // Optional: only needed if Pinecone vector search is enabled
  PINECONE_API_KEY: z.string().optional(),

  // Optional: only needed if web search is enabled
  EXA_API_KEY: z.string().optional(),

  // Optional: HMAC secret for signing compaction summaries
  SUMMARY_HMAC_SECRET: z.string().optional(),

  // Optional: bearer token for detailed /api/health checks in production
  HEALTH_CHECK_TOKEN: z.string().optional(),

  // Optional: shared rate-limit store (see proxy.ts). Both or neither.
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function fail(problems: string[]): never {
  console.error(
    `\n❌ Invalid environment configuration:\n${problems
      .map((p) => `  - ${p}`)
      .join("\n")}\n\nSee env.template for every variable and what needs it.\n`
  );
  throw new Error("Invalid environment variables");
}

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    fail(
      parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      )
    );
  }
  const env = parsed.data;
  const problems: string[] = [];
  const warnings: string[] = [];

  // --- At least one LLM provider must be usable ---
  const available = configuredVendors();
  if (available.length === 0) {
    problems.push(
      `no LLM provider key is set. Set at least one of: ${ALL_VENDORS.map(
        (v) => `${providerSpec(v).envKey} (${providerSpec(v).label})`
      ).join(", ")}`
    );
  }

  // --- The configured chat vendor ---
  if (available.length > 0 && !isVendorConfigured(DEFAULT_VENDOR)) {
    const fallback = PROVIDER_FALLBACK_ORDER.find(
      (v) => v !== DEFAULT_VENDOR && isVendorConfigured(v)
    );
    const target = fallback ?? available[0];
    warnings.push(
      `DEFAULT_VENDOR is "${DEFAULT_VENDOR}" but ${providerSpec(DEFAULT_VENDOR).envKey} is not set — ` +
        `chat will be served by "${target}" instead (see PROVIDER_FALLBACK_ORDER in config.ts).`
    );
  }

  // --- Configured model ids must exist in the catalog ---
  if (!vendorHasModel(DEFAULT_VENDOR, DEFAULT_MODEL_ID)) {
    warnings.push(
      `DEFAULT_MODEL_ID "${DEFAULT_MODEL_ID}" is not listed for vendor "${DEFAULT_VENDOR}" in lib/ai/providers.ts — ` +
        `that vendor's default model will be used. Add it to the catalog if this was intentional.`
    );
  }
  if (!vendorHasModel(UTILITY_VENDOR, UTILITY_MODEL_ID)) {
    warnings.push(
      `UTILITY_MODEL_ID "${UTILITY_MODEL_ID}" is not listed for vendor "${UTILITY_VENDOR}" in lib/ai/providers.ts — ` +
        `that vendor's default utility model will be used.`
    );
  }

  // --- Keys required by enabled features (hard failures) ---
  // These throw rather than warn: a deployment that silently lost its
  // knowledge base still answers questions, just ungrounded and uncited, which
  // is the one failure mode this app must not have quietly.
  if (ENABLE_VECTOR_SEARCH && !env.PINECONE_API_KEY) {
    problems.push(
      "ENABLE_VECTOR_SEARCH is on but PINECONE_API_KEY is not set. Set the key, or set ENABLE_VECTOR_SEARCH=false to run without the knowledge base."
    );
  }
  if (ENABLE_WEB_SEARCH && !env.EXA_API_KEY) {
    problems.push(
      "ENABLE_WEB_SEARCH is on but EXA_API_KEY is not set. Set the key, or set ENABLE_WEB_SEARCH=false."
    );
  }
  if (MODERATION_PROVIDER === "openai" && !isVendorConfigured("openai")) {
    problems.push(
      "MODERATION_PROVIDER=openai requires OPENAI_API_KEY. Use MODERATION_PROVIDER=llm to run the classifier on whichever vendor is configured."
    );
  }

  // --- Partial shared-store config is a mistake worth naming ---
  const upstashKeys = [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN];
  if (upstashKeys.some(Boolean) && !upstashKeys.every(Boolean)) {
    warnings.push(
      "Only one of UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN is set — the shared rate-limit store stays off and the in-memory limiter is used."
    );
  }

  if (problems.length > 0) fail(problems);

  for (const w of warnings) console.warn(`⚠️  ENV: ${w}`);

  if (process.env.NODE_ENV === "development") {
    console.info(
      `ENV: providers configured -> ${available.join(", ") || "none"}`
    );
  }

  return env;
}

// Memoized per warm serverless instance: the first request pays for
// validation, every request after reuses the cached result (or the cached
// throw — a misconfigured instance keeps failing loudly rather than
// re-validating into a possibly-different answer mid-instance-lifetime).
let cachedEnv: Env | null = null;
let cachedError: unknown = null;

export function ensureEnv(): Env {
  if (cachedEnv) return cachedEnv;
  if (cachedError) throw cachedError;
  try {
    cachedEnv = validateEnv();
    return cachedEnv;
  } catch (err) {
    cachedError = err;
    throw err;
  }
}
