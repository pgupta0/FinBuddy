# Attribution and third-party notices

## Base template

FinBuddy began as a fork of **[myAI6](https://github.com/dringel/myAI6)**, a
RAG chatbot template by **Daniel M. Ringel** ([ringel.ai](https://www.ringel.ai)),
released under the MIT License.

The MIT License permits modification, rebranding, and redistribution. It
requires one thing: the original copyright notice and permission text must be
retained in copies and substantial portions of the software. That notice is kept
in [`LICENSE`](LICENSE) alongside the FinBuddy team's own copyright, which is
why the file lists both. Removing the original line would make redistribution of
this project a license violation, so it stays — rebranding the user-facing app is
fine; erasing the upstream copyright is not.

The template author also asks that use of the code be acknowledged. This file and
the note in [`README.md`](README.md) are that acknowledgement.

### What came from the template

- Next.js + AI SDK chat shell, streaming UI, and `components/ui` (shadcn/ui)
- Parent-child chunking ingestion pipeline (`RAGloader/`)
- Citation canonicalization and verification (`lib/citations.ts`)
- Conversation compaction and summary signing
- Content-moderation layer and per-IP rate limiting

### What is FinBuddy's own work

- The deterministic risk-profiling engine: the fixed five-question quiz, its
  scoring bands, and the suitability caps that floor a profile regardless of
  score (`lib/risk-quiz-questions.ts`, `app/api/chat/tools/score-risk-profile.ts`,
  `app/api/chat/tools/present-risk-quiz.ts`)
- The curated real-fund dataset and lookup, with per-fund holdings, allocations,
  and source URLs (`lib/fund-recommendations-data.ts`,
  `app/api/chat/tools/fund-recommendations.ts`)
- The Indian financial-literacy knowledge base (`RAGloader/content/`)
- The forced-KB-search safety net (`lib/ai/kb-keywords.ts`)
- The multi-provider abstraction (`lib/ai/providers.ts`) and the retrieval
  rework in `lib/pinecone.ts`
- All SEBI/AMFI-specific guardrails and prompt content (`prompts.ts`)

See `DOCUMENTATION.md` Part D for the per-task contribution matrix.

## Content and data sources

Knowledge-base content is drawn from public regulatory and industry sources —
SEBI, AMFI, RBI, and fund houses' own published factsheets and disclosures.
Fund figures in `lib/fund-recommendations-data.ts` carry a `sourceUrl` to the
page each figure came from, which is what the app cites.

Fund, scheme, and asset-management-company names are used nominatively, to
identify real published products for educational comparison. FinBuddy is not
affiliated with, endorsed by, or sponsored by SEBI, AMFI, or any asset
management company, fund house, or broker.

## Regulatory position

FinBuddy is an educational tool. It is **not** a SEBI-registered Investment
Adviser or Research Analyst, and it does not provide individualized investment
advice, entry/exit price levels, stop-losses, or price targets. Those limits are
enforced in the system prompt guardrails (`prompts.ts`) and are deliberate, not
incidental — see `DOCUMENTATION.md`.

## Third-party services

| Service | Used for |
|---|---|
| Anthropic, Google (Gemini), OpenAI, Fireworks | Chat and background models |
| Pinecone | Vector storage, retrieval, and hosted reranking |
| Exa | Web search |
| Vercel | Hosting |
| Upstash Redis | Optional shared rate-limit counter |

Each is governed by its own terms; user inputs may be processed by them. See
`app/terms/page.tsx`.
