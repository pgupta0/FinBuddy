// config.ts
// Central FinBuddy configuration. No static MODEL export: the chat model is
// resolved per request from the settings below plus the API keys that are
// actually present (see lib/ai/providers.ts and lib/ai/model-registry.ts).

// Type-only import: erased at compile time, so this stays safe to import from
// client components alongside AI_NAME and friends.
import type { Vendor } from "@/lib/ai/providers";

function getDateAndTime(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `The day today is ${dateStr} and the time right now is ${timeStr}.`;
}

export const DATE_AND_TIME = getDateAndTime();

// --- Assistant identity (all user-facing naming derives from these) ---
export const AI_NAME = "FinBuddy"; // ← your assistant's name
export const OWNER_NAME = "the FinBuddy Team"; // ← legal/footer text only (app/page.tsx footer, app/terms/page.tsx) — the AI's own prompts no longer reference this
export const AI_DESCRIPTION = `
${AI_NAME} is a financial education assistant that helps first-time Indian investors understand how their savings are allocated and how that compares to common investment strategy frameworks (risk parity, core-satellite, endowment-style). It is not a registered investment adviser and does not give personalized financial advice.
`.trim();

// Browser tab / metadata title. Change freely — one line, no other edits needed.
export const BROWSER_TAB_TITLE = `${AI_NAME}`;

export const WELCOME_MESSAGE = `Hi, I'm ${AI_NAME}. I help you understand how your savings are allocated and compare that to common investment strategies — think of me as a financial literacy tool, not a financial adviser.`;
export const CLEAR_CHAT_TEXT = "New";

// --- Provider defaults ---
// Four vendors are supported — anthropic, openai, google (Gemini), fireworks —
// each defined once in lib/ai/providers.ts. Switching vendor is two lines here
// plus that vendor's API key; no other file needs editing.
// Running on Gemini (google) by default — it's the free-tier key this
// deployment actually has configured. Anthropic, OpenAI and Fireworks stay
// fully wired up as switchable options; add the matching API key and change
// DEFAULT_VENDOR (and UTILITY_VENDOR below) to use one of them instead.
export const DEFAULT_VENDOR: Vendor = "google";

// gemini-2.5-flash (stable), NOT gemini-3.5-flash: the 3.5-flash preview's
// free-tier quota is only 20 requests PER DAY (generativelanguage's
// "GenerateRequestsPerDayPerProjectPerModel-FreeTier" quota) — it was
// exhausted almost immediately in production, which silently broke every
// chat message for the rest of the day (AI_RetryError: 429 RESOURCE_EXHAUSTED,
// surfaced in Vercel's function logs). 2.5-flash's free tier is dramatically
// higher, so it survives real usage instead of a couple dozen messages/day.
export const DEFAULT_MODEL_ID = "gemini-2.5-flash";

// Order tried when DEFAULT_VENDOR (or UTILITY_VENDOR) has no API key set.
// This is what lets the same codebase fall back to whichever provider key is
// actually configured — nothing to edit, just a different key in .env.local
// or your host's environment variables. It does NOT retry a request that
// failed mid-stream; see resolveVendor() in lib/ai/model-registry.ts for why.
export const PROVIDER_FALLBACK_ORDER: Vendor[] = [
  "google",
  "openai",
  "fireworks",
  "anthropic",
];

export const DEFAULT_MODE = "chat" as const; // "chat" | "reasoning"

// Default thinking level (used when reasoning is triggered)
export const DEFAULT_THINKING_LEVEL = "medium" as const; // "off" | "low" | "medium" | "high"

// --- Utility Model (background tasks) ---
// Small, fast model used for background work: the moderation classifier and
// conversation compaction summaries. Independent of the chat model above, so you
// can run chat and utilities on different vendors — or switch everything to one
// vendor. The API key for the chosen vendor must be set.
export const UTILITY_VENDOR: Vendor = "google";
// Must be a model id listed for UTILITY_VENDOR in lib/ai/providers.ts; if it
// isn't, that vendor's own defaultUtilityModelId is used instead.
// e.g. "claude-haiku-4-5" (anthropic), "gpt-5.4-mini" (openai).
// Same reasoning as DEFAULT_MODEL_ID above: the 3.5 preview line's free-tier
// daily quota is only 20 requests and moderation runs on every single
// message, so it was the first thing to run out. gemini-2.5-flash has a much
// larger free-tier allowance.
export const UTILITY_MODEL_ID = "gemini-2.5-flash";

// --- Moderation denial messages ---
export const MODERATION_DENIAL_MESSAGE_SEXUAL =
  "I can't discuss explicit sexual content. Please ask something else.";
export const MODERATION_DENIAL_MESSAGE_SEXUAL_MINORS =
  "I can't discuss content involving minors in a sexual context. Please ask something else.";
export const MODERATION_DENIAL_MESSAGE_HARASSMENT =
  "I can't engage with harassing content. Please be respectful.";
export const MODERATION_DENIAL_MESSAGE_HARASSMENT_THREATENING =
  "I can't engage with threatening or harassing content. Please be respectful.";
export const MODERATION_DENIAL_MESSAGE_HATE =
  "I can't engage with hateful content. Please be respectful.";
export const MODERATION_DENIAL_MESSAGE_HATE_THREATENING =
  "I can't engage with threatening hate speech. Please be respectful.";
export const MODERATION_DENIAL_MESSAGE_ILLICIT =
  "I can't discuss illegal activities. Please ask something else.";
export const MODERATION_DENIAL_MESSAGE_ILLICIT_VIOLENT =
  "I can't discuss violent illegal activities. Please ask something else.";
export const MODERATION_DENIAL_MESSAGE_SELF_HARM =
  "I can't discuss self-harm. If you're struggling, please reach out to a mental health professional or crisis helpline.";
export const MODERATION_DENIAL_MESSAGE_SELF_HARM_INTENT =
  "I can't discuss self-harm intentions. If you're struggling, please reach out to a mental health professional or crisis helpline.";
export const MODERATION_DENIAL_MESSAGE_SELF_HARM_INSTRUCTIONS =
  "I can't provide instructions related to self-harm. If you're struggling, please reach out to a mental health professional or crisis helpline.";
export const MODERATION_DENIAL_MESSAGE_VIOLENCE =
  "I can't discuss violent content. Please ask something else.";
export const MODERATION_DENIAL_MESSAGE_VIOLENCE_GRAPHIC =
  "I can't discuss graphic violent content. Please ask something else.";
export const MODERATION_DENIAL_MESSAGE_DEFAULT =
  "Your message violates our guidelines. I can't answer that.";

// --- Pinecone ---
// Index names must be lowercase (letters, numbers, hyphens).
export const PINECONE_INDEX_NAME = "finbuddy-kb";

// Retrieve wide, then narrow. PINECONE_TOP_K is the CANDIDATE pool handed to
// the reranker; PINECONE_RERANK_TOP_N is what actually reaches the model.
// Before reranking, all 20 candidates went into the prompt, which is how a
// single knowledge-base search grew to ~15k input tokens.
export const PINECONE_TOP_K = 40;
export const PINECONE_RERANK_TOP_N = 6;

// Hosted reranking. "bge-reranker-v2-m3" is free on every Pinecone plan and is
// multilingual, which matters for the Hindi/English glossary content. Set
// PINECONE_RERANK_MODEL to null to skip reranking entirely (then PINECONE_TOP_K
// results are truncated to PINECONE_RERANK_TOP_N by raw vector score instead).
export const PINECONE_RERANK_MODEL: string | null = "bge-reranker-v2-m3";
// Field the reranker scores against — must be a field stored on child records.
export const PINECONE_RERANK_FIELD = "text";

// Minimum raw vector score for a candidate to be worth reranking. The base
// template used 0.1, which in a small index excludes almost nothing, so every
// query returned a full 20 chunks whether or not any were relevant. This is a
// pre-filter now, not the final quality gate — the reranker is.
export const PINECONE_MIN_SCORE = 0.25;

// Parent-child retrieval (3-namespace architecture)
export const PINECONE_USE_PARENT_CHILD = true; // false = legacy "default" namespace
export const PINECONE_NS_CHILDREN = "children";
export const PINECONE_NS_PARENTS = "parents";
export const PINECONE_NS_PROPOSITIONS = "propositions";
export const PINECONE_PROP_BOOST = 0.5; // proposition score weight (pre-rerank nudge only)
export const PINECONE_PROP_K = 15; // propositions retrieved per search to boost children

// Parent expansion: a matched child is replaced by its larger parent chunk for
// context. Unbounded, this is the single largest input-token cost in the app
// (every parent is ~3,000 chars), so it is capped and can be switched off.
export const PINECONE_EXPAND_TO_PARENT = true;
export const PINECONE_PARENT_MAX_CHARS = 2400;

// Figure/table enrichment: an extra per-source query that pulls a document's
// visuals into context. FinBuddy's knowledge base is markdown prose with no
// figures or slides, so this is OFF — left configurable because the ingestion
// pipeline still supports PDF/slide sources if the KB ever grows into them.
// When it was on, it fired one sequential Pinecone query per retrieved source
// and returned nothing.
export const PINECONE_ENABLE_VISUAL_ENRICHMENT = false;
export const PINECONE_VISUAL_TOP_K = 20; // topK for the visual-enrichment query, when enabled
export const PINECONE_VISUALS_PER_SOURCE = 20; // max figure/table chunks merged per source, when enabled

// --- Knowledge Base Scope (tells the model what topics are indexed) ---
// Update this list whenever you ingest new content into Pinecone.
// The model uses this to decide whether to search the KB or skip it entirely.
export const KB_SCOPE = `
The knowledge base covers financial literacy content for first-time Indian investors. Topics include:

- AMFI mutual fund NAV data and fund categories
- SEBI regulatory guidance relevant to retail investors
- A glossary of financial terms (expense ratio, direct vs. regular plans, SIP, asset allocation), including Hindi translations
- Plain-language explainers of strategy frameworks: risk parity, core-satellite, and endowment-style allocation
- Real-world allocation benchmarks from actual mutual funds, PMS (Portfolio Management Services) strategies, and family-office allocation trends, mapped to the four risk-profile tiers (Conservative/Moderate/Growth-oriented/Aggressive)

Any question about these topics, or about a user's own uploaded portfolio in relation to them, is within scope. Requests for advice on individual securities (a specific stock or bond to buy/sell) or trade execution are explicitly OUT of scope. A structured, asset-class-level allocation recommendation following the fixed risk-profile quiz IS in scope — see the guardrails for the exact boundary.
`.trim();

// --- Exa Web Search ---
export const EXA_NUM_RESULTS = 10;
export const EXA_SEARCH_TYPE = "deep" as const; // "auto" | "neural" | "deep" | "deep-reasoning"
export const EXA_MAX_CHARACTERS = 3000; // max chars of page text per result
// "preferred" makes Exa fetch live page content when possible, reducing the odds
// that stale or deleted pages (e.g. dead university URLs) surface in results.
export const EXA_LIVECRAWL = "preferred" as const; // "never" | "fallback" | "preferred" | "always"
export const EXA_SYSTEM_PROMPT = `Prefer authoritative sources: SEBI, AMFI, RBI, and other official regulatory or financial-institution publications, plus reputable financial journalism. Avoid unregistered "finfluencer" content, low-quality aggregators, and pages that appear outdated or removed.`;

// --- Chat Route Limits ---
// Hard cap on tool-use steps per request. Must cover the per-response soft
// budgets below, the risk-quiz tool chain (presentRiskQuiz -> scoreRiskProfile
// -> fundRecommendations = 3 steps), and the final compose step.
export const MAX_STEPS = 8; // max tool-use steps per request
// Per-response soft budgets (enforced via prompt guidance in lib/ai/tools.ts).
export const MAX_KB_SEARCHES = 2; // max vectorDatabaseSearch calls per response
export const MAX_WEB_SEARCHES = 3; // max webSearch calls per response
export const MAX_MESSAGES = 100; // max messages in conversation history
export const MAX_MESSAGE_TEXT_LENGTH = 10000; // max chars per user message
export const VERCEL_MAX_DURATION = 120; // Vercel Pro plan function timeout in seconds

// --- Message Attachments (lib/attachments.ts, app/page.tsx) ---
// Images/PDFs travel as base64 inside the request body, and the whole
// conversation history — attachments included — is resent on every turn.
// Vercel serverless functions reject request bodies over ~4.5MB, and
// base64 inflates a file by about a third, so these limits stay well
// under that ceiling rather than chasing it exactly.
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;
export const MAX_ATTACHMENT_FILE_SIZE_MB = 2;
export const MAX_ATTACHMENT_TEXT_CHARS = 4000; // budget for CSV/text attachments folded into the message body

// --- Conversation Compaction ---
// Summarizes older messages when token count exceeds threshold to reduce input costs.
export const COMPACTION_ENABLED = true; // set false to disable compaction
export const COMPACTION_TOKEN_THRESHOLD = 40000; // compact when summary + unsummarized messages exceed this (tokens)
export const COMPACTION_KEEP_RECENT = 4; // keep last N messages intact when compacting (2 user + 2 assistant turns)
export const COMPACTION_CHARS_PER_TOKEN = 4; // heuristic: chars/token ratio for estimation (lower = more conservative)
export const COMPACTION_MAX_SUMMARY_WORDS = 1500; // max word limit for LLM summary (LLM should be concise but not artificially short)
export const COMPACTION_MAX_SUMMARY_CHARS = 8000; // hard safety cap on summary length (truncates if LLM exceeds — should rarely trigger)
export const COMPACTION_SHOW_CONTEXT_MEMORY = true; // show "Context Memory" button in header to view summary

// --- Prompt Caching ---
// The system prompt (prompts.ts) plus the generated tool guidance
// (lib/ai/tools.ts) is a large, byte-identical prefix on every single request —
// the risk-quiz instructions alone run to thousands of tokens. Marking it
// cacheable means the provider charges the discounted cache-read rate for it
// after the first call instead of full input price every turn.
// Only vendors whose spec sets supportsPromptCaching get an explicit marker
// (Anthropic today); OpenAI and Gemini cache long prefixes implicitly, so the
// flag is a no-op for them rather than an error.
export const PROMPT_CACHING_ENABLED = true;
// Anthropic cache TTL: "5m" (default) or "1h". "1h" costs more to write and
// suits steady traffic; "5m" suits bursty use, which is the realistic pattern
// for a student-project deployment.
export const PROMPT_CACHE_TTL: "5m" | "1h" = "5m";

// --- Thinking Budget (tokens) ---
export const THINKING_BUDGET_LOW = 2000;
export const THINKING_BUDGET_MEDIUM = 8000;
export const THINKING_BUDGET_HIGH = 15000;
// Thinking level used in plain "chat" mode (reasoning mode uses the routed level).
export const CHAT_THINKING_LEVEL = "low" as const; // "low" | "medium" | "high"

// --- Output Tokens ---
// Hard cap on response tokens per request. undefined = the provider's default.
// If set while Anthropic thinking is enabled, it must EXCEED the thinking
// budget in use (the API rejects max_tokens <= thinking budget).
export const MAX_OUTPUT_TOKENS: number | undefined = undefined;

// --- Reasoning Escalation ---
export const STRONG_REASONING_LENGTH_THRESHOLD = 1800; // long messages with code keywords → high reasoning

// --- Citation Verification (green check in the Sources box) ---
// The sentence preceding each citation (its claim) is checked against the
// cited source's retrieved text by significant-word containment; legacy
// in-citation quotes, when present, are checked by substring/containment.
export const CITATION_CLAIM_MIN_CHARS = 20; // shorter preceding fragments are not treated as claims
export const CITATION_CLAIM_MAX_CHARS = 300; // claims are trimmed to their last N chars
export const CITATION_CLAIM_MIN_WORD_LENGTH = 4; // "significant" words for claim matching
export const CITATION_CLAIM_MIN_WORDS = 3; // claims with fewer significant words are unverifiable
export const CITATION_CLAIM_MATCH_RATIO = 0.6; // share of significant words that must appear in the source
export const CITATION_QUOTE_MIN_WORD_LENGTH = 3; // "significant" words for quote matching
export const CITATION_QUOTE_MATCH_RATIO = 0.8; // share of quote words that must appear in the source

// --- Rate Limiting ---
// IMPORTANT — how this actually behaves in production:
// The in-memory limiter keeps its counters inside ONE serverless instance.
// Vercel runs several concurrent instances and recycles them, so with N warm
// instances the effective ceiling is roughly RATE_LIMIT_MAX_REQUESTS x N, and
// a cold start resets a client's history to zero. It raises the cost of casual
// abuse; it is not a real quota.
// Setting UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (free tier, no
// package needed — proxy.ts calls the REST API with fetch) switches to a shared
// counter that holds across instances and restarts. See env.template.
export const RATE_LIMIT_ENABLED = true; // set false to disable rate limiting
export const RATE_LIMIT_WINDOW_MS = 60_000; // window size (1 minute)
export const RATE_LIMIT_MAX_REQUESTS = 20; // max requests per window per IP
// When the shared store is configured but unreachable, allow the request
// ("open") or block it ("closed"). Open by default: a Redis blip should not
// take the whole chat down.
export const RATE_LIMIT_STORE_FAIL_POLICY: "open" | "closed" = "open";

// --- Pinecone Cache ---
export const PINECONE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// --- Moderation ---
// Provider that checks user messages for harmful content BEFORE they reach the chat model.
// Set via the env var MODERATION_PROVIDER (in Vercel or .env.local); defaults to "llm":
// "llm"    = LLM classifier running on the utility model above (any vendor)
//            ("anthropic" is accepted as a legacy alias for this value)
// "openai" = OpenAI's dedicated moderation API (requires OPENAI_API_KEY with access to omni-moderation-latest)
// "off"    = no moderation call at all; relies solely on the system prompt guardrails
export type ModerationProvider = "llm" | "openai" | "off";
const _moderationEnv = process.env.MODERATION_PROVIDER?.toLowerCase();
export const MODERATION_PROVIDER: ModerationProvider =
  _moderationEnv === "openai" || _moderationEnv === "off"
    ? _moderationEnv
    : "llm";

// "open" = allow requests when the moderation service is unavailable
// "closed" = block requests when the moderation service is unavailable
// (irrelevant when MODERATION_PROVIDER = "off")
export const MODERATION_FAIL_POLICY = "closed" as const;

// --- Reasoning Display ---
// Controls how the thinking/reasoning block is shown in the chat UI.
// "full"       = show collapsible reasoning with full text (debugging only — exposes prompts!)
// "truncated"  = show first N words of reasoning, then "..." (safe, gives a glimpse)
// "hidden"     = show only the past-tense label (e.g., "Reasoned for 2 seconds"), no expandable content
export type ReasoningDisplayMode = "full" | "truncated" | "hidden";
export const REASONING_DISPLAY_MODE: ReasoningDisplayMode = "truncated";
export const REASONING_TRUNCATE_WORDS = 15; // words to show in "truncated" mode

// --- Backend toggles (enabled by default) ---
// Disable web search by setting the env var: ENABLE_WEB_SEARCH=false
export const ENABLE_WEB_SEARCH =
  process.env.ENABLE_WEB_SEARCH?.toLowerCase() !== "false";

// Disable the Pinecone knowledge base by setting the env var: ENABLE_VECTOR_SEARCH=false
// When off: the KB tool is removed from the model, no Pinecone connection is made,
// and PINECONE_API_KEY is not needed. The bot answers from general knowledge (+ web search if enabled).
export const ENABLE_VECTOR_SEARCH =
  process.env.ENABLE_VECTOR_SEARCH?.toLowerCase() !== "false";
