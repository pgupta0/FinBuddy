# FinBuddy Agent Guide

FinBuddy is a financial education assistant for first-time Indian investors,
built on the [myAI6](https://github.com/dringel/myAI6) template (MIT — see
`NOTICE.md`). It is **not** a registered investment adviser: the SEBI-related
guardrails in `prompts.ts` are load-bearing, not decoration. Do not loosen them.

## Configuration Model

Configuration is split into two places:

- **Env vars** (Vercel dashboard or `.env.local`) — secrets and operational switches:
  provider API keys, `ENABLE_VECTOR_SEARCH`, `ENABLE_WEB_SEARCH`,
  `MODERATION_PROVIDER`, `ENABLE_LIVE_HOLDING_PRICES`, the optional shared
  rate-limit store (`UPSTASH_REDIS_REST_*`), and the security vars
  `SUMMARY_HMAC_SECRET` and `HEALTH_CHECK_TOKEN`. See `env.template` for all of
  them with explanations. Secrets are server-side only — never use a
  `NEXT_PUBLIC_` prefix, which embeds values in the public JS bundle.
- **`config.ts`** — design and tuning parameters: vendor/model selection and
  `PROVIDER_FALLBACK_ORDER`, the utility model, thinking budgets, prompt caching,
  Pinecone index/namespaces/reranking/thresholds, compaction, reasoning display,
  rate limits, search budgets (`MAX_STEPS`, `MAX_KB_SEARCHES`,
  `MAX_WEB_SEARCHES`), output token cap, Exa settings, citation-verification
  thresholds, and `KB_SCOPE`.

**At least one provider key must be set**, or `lib/env.ts` refuses to boot.
`DEFAULT_VENDOR` is `anthropic` and should stay that way (project requirement);
`PROVIDER_FALLBACK_ORDER` is what lets the same code run on a free Gemini key
alone for local development.

## Key Files

| File | Purpose |
|------|---------|
| `config.ts` | Design/tuning parameters (see above) |
| `env.template` | All env vars (keys + feature switches) with explanations |
| `prompts.ts` | AI behavior, tone, confidentiality, citations, SEBI guardrails |
| `app/api/chat/route.ts` | Main chat endpoint (orchestrator) |
| `proxy.ts` | Per-IP rate limiting for `/api/chat` (Next 16's middleware entry point) |
| `lib/ai/providers.ts` | **Vendor table — the single source of truth for every provider** |
| `lib/ai/model-registry.ts` | Resolves config + available keys into model handles |
| `lib/ai/routing.ts` | Server-side vendor/model/mode routing and provider options |
| `lib/ai/tools.ts` | Tool set assembly + the generated tool guidance prompt |
| `lib/ai/kb-keywords.ts` | Terms that force a real KB search on the first tool step |
| `lib/pinecone.ts` | Retrieval: parallel children+propositions → rerank → parents |
| `lib/sources.ts` | Context assembly and citation formatting |
| `lib/citations.ts` | Citation canonicalization + claim verification |
| `lib/moderation.ts` | Content moderation (`llm` / `openai` / `off`) |
| `lib/compaction.ts` | Conversation summarization for long chats |
| `lib/summary-signature.ts` | HMAC signing/verification of compaction summaries |
| `lib/fund-recommendations-data.ts` | Curated real-fund dataset (holdings, allocations, source URLs) |
| `lib/risk-quiz-questions.ts` | The fixed 5-question quiz — shared by the prompt and the widget |
| `components/messages/sources.tsx` | Code-rendered Sources box (from the `data-sources` stream part) |

## Adding an LLM Vendor

Add one entry to the `PROVIDERS` table in `lib/ai/providers.ts`: its model
catalog, `envKey`, `create()`, `thinkingOptions()`, `utilityOptions()`, and the
two capability flags. Nothing else needs editing — `routing.ts`, `lib/env.ts`,
`lib/moderation.ts` and `lib/compaction.ts` contain no vendor names. Then add the
key to `env.template` and the model table in `README.md`.

If a vendor rejects a forced `tool_choice` while extended thinking is on (as
Anthropic does), set `forcedToolChoiceConflictsWithThinking: true` rather than
special-casing it in the chat route.

## Tools

Tools live in `app/api/chat/tools/`. Each is conditionally included in
`lib/ai/tools.ts` based on the feature switches (`ENABLE_VECTOR_SEARCH`,
`ENABLE_WEB_SEARCH`); the risk-profiling tools are always available, since they
depend on neither.

| Tool | File | Description |
|------|------|-------------|
| `vectorDatabaseSearch` | `search-vector-database.ts` | Pinecone RAG search |
| `webSearch` | `web-search.ts` | Exa web search |
| `presentRiskQuiz` | `present-risk-quiz.ts` | Client-side tool (no `execute`) — pauses the turn so the browser renders the interactive quiz |
| `scoreRiskProfile` | `score-risk-profile.ts` | Deterministic scoring + suitability caps |
| `fundRecommendations` | `fund-recommendations.ts` | Curated real-fund lookup by risk tier |

UI display for tools is in `components/messages/tool-call.tsx`; rotating labels
are in `lib/fun-labels.ts`.

**Why the last three are deterministic code, not model judgement:** a risk score
the model invents is unsafe and unreproducible, and a fund figure the model
recalls is uncitable. Keep them that way. `lib/ai/kb-keywords.ts` exists for the
same reason — prompt instructions alone did not reliably make the model search
the KB for plain glossary terms, so the first tool step is forced when a known
indexed term appears.

The search tools are factories (`createWebSearch`, `createVectorDatabaseSearch`)
taking a `collect` callback, and push a structured `UISource` (`types/data.ts`)
for every source retrieved. Citation numbering is canonicalized by
`lib/citations.ts` (unit-tested): the model's own `[[N]]` numbers are IGNORED —
citations are renumbered sequentially by first appearance and bare `[[N]]` debris
is stripped. The client applies this to displayed text
(`assistant-message.tsx`); the chat route runs the same function on the joined
answer text to build the `data-sources` stream part, rendered by
`components/messages/sources.tsx` as the SINGLE reference list (the model writes
no References section). Inline and box numbers agree by construction.

## Adding a Tool

1. Create `app/api/chat/tools/my-tool.ts` using the `tool()` helper from `ai`
2. Import and add to `lib/ai/tools.ts` (with a feature switch if toggleable)
3. Add display config in `components/messages/tool-call.tsx` (icon, label category)
4. Add labels in `lib/fun-labels.ts` if using a new category
5. Check `MAX_STEPS` in `config.ts` still covers the longest tool chain

## Retrieval

`lib/pinecone.ts` runs: children + propositions in parallel → score floor →
proposition nudge → dedupe by parent → **rerank to `PINECONE_RERANK_TOP_N`** →
expand survivors to parents (capped). Reranking uses Pinecone's hosted
`bge-reranker-v2-m3` and degrades to raw vector order on any failure.

Two things to keep in mind when changing this:

- Rerank **before** parent expansion. Children are the precise units the
  reranker judges best, and narrowing first means ~6 parent fetches, not ~40.
- Parent expansion is the app's largest input-token cost. `PINECONE_PARENT_MAX_CHARS`
  bounds it; do not remove the bound.

Figure/table enrichment (`PINECONE_ENABLE_VISUAL_ENRICHMENT`) is **off** — this
knowledge base is markdown prose with no figures. Leave it off unless the KB
gains PDF or slide sources.

## Ingestion

Content is ingested via `RAGloader/RAG_loader_pipeline.ipynb`, which imports its
classes and functions from `RAGloader/finbuddy_rag.py`. See `README.md` for
pipeline documentation (stages incl. formula-to-LaTeX repair, content types,
Cloudinary/SFTP image hosting, index utilities) and
`RAGloader/CHUNKING.md` for the chunk sizing this corpus is tuned for.
Notebooks must never be committed with API keys or other credentials filled in.
