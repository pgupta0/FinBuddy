# FinBuddy — Documentation

**Team FinBuddy** — Mihira Navva, Mahak Kalani, Mudita Agarwal, Pratham Gupta
BITSoM MBA 2026 · *AI in Business: From Models to Agents* · Midterm Project
**Live app:** https://myai6-private.vercel.app · **Repository:** this repo (private, shared with `dringel`)

---

## Part A — The Product Case

*This section is FinBuddy's business case as scoped and validated with the team's own primary research (A5, n=80 survey). It documents the full product direction the team argued for and tested; Part C documents the v1 slice actually built and deployed within the assignment's timeframe — the deterministic risk quiz and fund-recommendation engine, described in A1–A3's competitive comparison. Where a broader capability referenced below (e.g. multi-language chat) was not part of the v1 build, that gap is called out explicitly rather than implied by omission — see the scope note after A5 and Part B/C for exactly what shipped.*

### A1. Unique Selling Proposition

**One sentence:** FinBuddy is an AI portfolio manager for first-time Indian investors that scores their real risk profile through a short quiz, allocates their money using the same institutional strategy logic (risk parity, core-satellite, endowment-style) that private banks and family offices use, and backs every recommendation with real, cited fund data instead of a model's guess.

**Paragraph earning it:** Most first-time Indian investors either get no structured guidance or get commission-conflicted advice from a distributor whose incentives don't match theirs. Fewer than 1,000 SEBI-registered investment advisers exist to serve over 20 crore investors in India, so structured, fiduciary-quality advice is functionally inaccessible to most people at this wealth level. General-purpose AI chatbots can produce a plausible-sounding allocation if prompted well, but they don't remember the user's profile between sessions, don't ground numbers in real fund/market data, don't enforce allocation discipline against a persuasive follow-up message, and don't track drift over time. This product closes that gap specifically for people who are underserved on two axes at once: they lack investing expertise, and they're often more comfortable transacting in Hindi or a regional language than in English. **(Survey note: our own primary research (see A5) independently confirms the core pain point — low confidence in current allocation and high stated interest in exactly this kind of assistant — though it complicates the language-differentiation claim; see A5.4.)**

### A2. Target Audience

Adults in India, roughly 25–45, salaried, with some investable savings across one or two platforms but no structured allocation strategy. More comfortable discussing money in Hindi or a regional language, often mixed with English financial terms (Hinglish), than in formal English.

**How they do this today, and what it costs them (reasoned estimate, partially corroborated by A5):**
- Commission drag from distributor-sold "regular plan" mutual funds vs. "direct plan" equivalents. The expense ratio gap between regular and direct plans typically runs **0.5–1.5 percentage points annually** (a well-documented structural feature of Indian mutual fund pricing; a current-year, precisely sourced AMFI/SEBI figure is still needed to cite here). Assuming a mid-range **1.0 percentage point** drag on an assumed average target-user portfolio of **₹3,00,000** gives an estimated **₹3,000/year** in avoidable cost per user — a reasoned estimate, not a sourced statistic.
- Concentration risk from unstructured, single-instrument savings.
- Time cost of self-education through scattered, often low-quality content, frequently only in English.
- **Survey corroboration**: respondents report low confidence in their current allocation (2.48/5 average — see A5.1) and cite "understanding how much to allocate" and "knowing where to invest" as their two single biggest challenges, ahead of every other option including terminology and language — directly matching the pain point described here.

### A3. Novelty and Competitive Differentiation

| Alternative | Where FinBuddy is better | Where FinBuddy is worse | Why it matters |
|---|---|---|---|
| **General-purpose chatbots (ChatGPT, Claude, Gemini)** | Persistent, deterministic risk profile and fund data; allocation rules enforced as code, not a suggestion; a fixed, verified fund dataset instead of model memory | No general knowledge breadth outside finance; requires adopting a new app | A generic chatbot can be argued out of a suitable allocation and, as the "Waaree/Wari" bug this project found and fixed shows (C6), will silently accept a misspelled security name and fabricate return forecasts for it. Our survey found 13/80 respondents (16%) already use ChatGPT/AI tools for investment advice today — a real existing habit this product needs to out-perform, not just an abstract alternative |
| **Existing Indian robo-advisors (Scripbox, Kuvera)** | Deeper vernacular support for financial terms specifically; free at point of use | Newer entrant, no track record; narrower instrument coverage at launch (20 curated funds vs. established players' full universe — a deliberate v1 scope decision) | Manual entry and unfamiliar platforms are a real adoption barrier for a less digitally fluent, English-second-language user |
| **Bank relationship manager / distributor** | No commission conflict; consistent, rule-based recommendations | No human relationship or trust built over time | Commission-driven advice is a stated, current regulatory concern in India. Our survey shows banks/distributors are already a minority advice source (18/80) compared to finance apps (42/80) and social media (34/80) — the real competition for attention is informal digital sources, not bank advisors |
| **Doing nothing / self-directed guessing** | Any structured strategy beats an unstructured single-instrument default | Requires the user to trust and adopt a new tool | Inertia is the actual default behavior today, with a real if invisible cost |

**"AI-powered" is explicitly not used as a differentiator** — ChatGPT/Claude/Gemini are AI-powered too. The differentiators above are data grounding, deterministic scoring, and India-specific UX.

### A4. Value Generation and Business Case

**All figures in this section are reasoned estimates for a Year-1 pilot of a monetized version of FinBuddy, not measured behavioral data — the survey materially improves the pricing assumption but is still stated intent, not observed conversion. FinBuddy's v1 build (Part C) is deployed as a free class-project assistant with no paywall; the business case below is the path the team would take to a monetized product, and is explicitly flagged as such rather than presented as this semester's revenue.**

**Use → Adoption → Impact → Value generation chain**

1. **Use** — Addressable pool at launch: **50,000 target-persona individuals/month**, reachable via app-store discovery, Hindi/regional-language social ads, and an assumed partnership with 2–3 mid-size employer wellness programs (~5,000 employees each). Each user is assumed to have **4 eligible "uses" per year** (quarterly portfolio check-ins), giving **200,000 eligible uses/year**.
2. **Adoption** — **8% of the addressable pool signs up** in Year 1 (**4,000 users**). Of these, assume **60% complete at least one portfolio upload** (**2,400 active users**), averaging **3 uses/year each** (**12,000 total uses/year**, i.e. **6% of the 200,000 eligible-use pool**). *(Survey context: 55/80 respondents said they'd want 5–10 minute sessions and only 1/80 rejected a chat interface outright — both support a low-friction onboarding assumption, but the survey did not test actual upload completion, so 60% remains unvalidated.)*
3. **Impact per use** — Each use is assumed to reduce avoidable cost (commission drag + misallocation) by roughly a quarter of the ₹3,000/year estimate in A2, i.e. **~₹750 per use**, on the assumed average portfolio size of ₹3,00,000.
4. **Value generation (capture)** — Our survey found **96.25% of respondents (77/80) willing to pay something**, with the dominant band being **₹1,000–2,000/year (66/80, 82.5% of all respondents)**. Revising: assume **50% of the 4,000 signed-up users convert to paid** *(stated willingness, not measured payment behavior)* at **₹1,499/year** *(a defensible point within the survey band, consistent with a ~₹1,499/year competitor anchor)* = **2,000 paying users × ₹1,499 ≈ ₹29,98,000/year revenue**.

**Value equation, populated with the above assumptions:**
```
Expected net value
  = eligible volume            (200,000 eligible uses/year)
  × adoption                   (6% of eligible uses reached)
  × incremental effect per use (~₹750 avoidable cost per use)
  × unit value of that effect  (already expressed in ₹, so = 1)
  × benefit-capture rate       (₹1,499/yr sub, ~50% of signed-up users convert; price informed by survey)
  − total cost of ownership    (~₹8,00,000/year — see below)
  − expected loss from errors  (~₹1,40,000/year — see below)

≈ Revenue ₹29,98,000 − TCO ₹8,00,000 − Error/risk loss ₹1,40,000
≈ Expected net value: ₹20,58,000 in Year 1
≈ Simple 12-month return: ~257% (net value ÷ total cost of ownership)
```
**Caution on this number**: it looks attractive largely because the pricing assumption is grounded in stated survey preference rather than an older placeholder figure. Stated willingness to pay in a convenience-sample survey with no real payment friction (see A5.6) reliably overstates real conversion; this should be treated as an optimistic upper bound, not a forecast, until tested with an actual paywall or pilot.

**Total cost of ownership:**
| Item | Assumed annual cost | Reasoning |
|---|---|---|
| LLM/model API usage (~4,000 MAU, moderate use) | ₹2,00,000 | Rough per-token cost estimate for a chat + RAG workload at this user count |
| Market data licensing (AMFI is free; assume one paid provider for equity/fund data) | ₹2,00,000 | Placeholder based on typical small-scale commercial data licensing |
| Hosting/infra (Vercel + Pinecone + storage) | ₹1,00,000 | Rough estimate for this user scale |
| Maintenance, oversight, compliance review time | ₹3,00,000 | Assumes part-time allocation of one person's time |
| **Total** | **₹8,00,000** | Sum of above, all unverified |

**Expected loss from errors/risk:** assume 2% annual churn among paying users attributable to a parsing or recommendation error, plus a ₹1,00,000/year reserve for potential compliance review costs ≈ **₹1,40,000/year** total.

**Sources actually verified (not assumptions):**
- SEBI Investment Advisers Regulations, 2013 requiring RIA registration for personalized advice — https://ckredencewealth.com/our-resources/ria-india (cites <1,000 SEBI-registered RIAs vs. 20+ crore investors as of August 2025).
- SEBI's AI Accountability Framework and stance that AI use increases, not reduces, adviser responsibility — https://www.mondaq.com/india/securities/1759228/sebis-new-digital-compliance-rules-what-investment-advisers-must-know-in-2026
- Comparator pricing reference point (~₹1,499/year for one AI wealth advisor) — https://www.genvest.ai/blog/ai-wealth-advisor-india-guide
- Our own primary research survey (n=80) — see A5 for full methodology and findings.
- **[ ] still missing:** a properly sourced, current-year figure for the direct-vs-regular mutual fund expense ratio gap, and any real pilot/behavioral (not stated-intent) data.

**Metrics by measurement layer:**

| Layer | Candidate metric | Owner |
|---|---|---|
| Technical performance | Pinecone retrieval precision (see C2); citation-verification pass rate | Mihira Navva |
| User adoption & engagement | Signup rate; risk-quiz completion rate; uses/user/year | Mahak Kalani |
| Operational | Median response latency; Anthropic/Pinecone spend per 1,000 messages | Pratham Gupta |
| Strategic outcomes | Share of users completing a rebalancing action after a nudge (v2) | Mudita Agarwal |
| Financial impact | Revenue per paying user (v2); total cost of ownership per user | Mahak Kalani, Mudita Agarwal |

**End-to-end value owner:** Mahak Kalani, Mudita Agarwal — jointly accountable end-to-end for this case holding up.

**What would have to be true for this case to fail:**
- The regulatory posture (registered RIA vs. educational-only) turns out to prohibit the recommendation depth assumed here — FinBuddy's v1 build stays deliberately on the educational side of this line (see C5).
- Stated willingness to pay (96.25% in our survey) does not translate into actual conversion once a real payment screen exists — a well-documented stated-vs-revealed-preference gap, and the single biggest risk to the A4 numbers above.
- Vernacular language quality for financial terms isn't good enough to earn trust — though per A5.4, our own survey data doesn't strongly support language as the primary driver of adoption, which changes the size of this risk relative to earlier assumptions.
- Usage volume is high enough that model-API cost per user exceeds any realistic captured value, since the deployed v1 carries no direct revenue at all.

### A5. Primary Research — Survey Findings

**Methodology:** A structured survey (Google Form) was administered to gauge interest in and shape the product concept before further build investment. **n = 80 valid responses** (one additional response was excluded as a likely test/placeholder entry with every option selected). This is a convenience sample, not a randomized or stratified one, and results should be read as directional signal, not a market-sizing study. Distributed via a Google Form (https://forms.gle/x6WP3wHUduL4WJwn8) circulated over WhatsApp on September 4, 2026. As with any personal-network distribution channel, results likely skew toward a more financially literate, English-comfortable population than the stated target audience.

**A5.1 — Problem validation**
- Average self-rated confidence that current investments are appropriately allocated: **2.48 / 5** — low confidence, directly supporting the core problem stated in A1/A2.
- Top self-reported investment challenges (respondents could select up to 3): "How much to allocate" (46/80), "Knowing where to invest" (42/80), "Finding unbiased advice" (38/80), "Knowing if portfolio is too risky" (36/80), "Knowing when to rebalance" (30/80), "Assessing risk level" (29/80). These map closely onto FinBuddy's actual v1 features — the risk quiz and allocation-benchmark knowledge base.
- Current advice sources are dominated by informal/digital channels rather than professionals: finance apps/platforms (42/80), YouTube/social media (34/80), friends/family (26/80) — all ahead of financial advisors (18/80) and banks/distributors (18/80). Notably, **13/80 (16%) already use ChatGPT or other AI tools** for this purpose today, which is both validating (people are already comfortable asking an AI) and a direct competitive signal (see A3).

**A5.2 — Concept validation**
- When shown a description of the proposed AI assistant (portfolio analysis, risk assessment, allocation suggestions, explanations, and progress tracking), average stated usefulness was **4.6 / 5**. This is a reaction to a *description*, not a working product, and self-selected respondents answering a survey about an AI tool likely skew favorably — treat this as validation of the concept's appeal, not a usage or retention forecast.

**A5.3 — Willingness to pay**
- **77/80 (96.25%)** said they would pay something for this service; only 3/80 said they'd use it only if free.
- Among those willing to pay, the dominant band was **₹1,000–2,000/year (66/80, 82.5% of the full sample)** — the concentration in one band is worth noting as possibly reflecting how the pricing options were presented in the survey rather than a precise price-sensitivity measurement. A4 uses ₹1,499/year, a defensible point within this band, but it should still be tested with an actual pricing experiment.

**A5.4 — Feature prioritization, and a finding that complicates our own narrative**
- Most-wanted features by vote: Recommended portfolio allocation (38), Explainable recommendations (34), Portfolio risk/concentration analysis (33), Personalised risk assessment (32), Upload portfolio photo/statement (27), Drift alerts vs. target (25), Regular portfolio check-ups (25). This directly validates FinBuddy's actual v1 build order — the risk quiz and fund-recommendation/explanation layer were built first, exactly matching the top four votes.
- **Important counter-signal**: "Finding advice in preferred language" was selected by only **6/80 respondents** as a top-3 challenge — the lowest-ranked challenge in the entire survey — and language-specific interaction wasn't a standalone top feature vote either. This sits in tension with how heavily A1/A3 lean on vernacular language support as a headline differentiator, and is a real reason FinBuddy's v1 did not prioritize building multi-language chat: either (a) the target population genuinely deprioritizes this relative to allocation/risk help, or (b) the sample (likely reachable via a business-school network) is more English-comfortable than the true target audience in A2. This should be tested directly with a sample closer to the actual target persona before further investment either way.

**A5.5 — Interaction and session design**
- 55/80 (69%) preferred a 5–10 minute session; only 3/80 wanted under 2 minutes and 22/80 wanted 10–20 minutes — supports keeping FinBuddy's risk quiz and core interaction tight, which is how it was built (a fixed 5-question flow, not an exhaustive one).
- Preferred interaction style was fairly evenly split between short Q&A (23), detailed Q&A (23), and ongoing conversation (20), with only 1/80 rejecting a chat interface outright — validates the chat-based interaction model FinBuddy uses, without a strong signal to over-invest in one specific interaction mode over another for v1.

**A5.6 — Limitations of this data (explicit, not hidden)**
- Small, convenience sample (n=80); not randomized or stratified by the actual target segments named in A2.
- Skews young: 31/80 under 25, 42/80 aged 25–45, only 7/80 aged 45–60, and zero respondents 60+ — reasonably aligned with A2's stated 25–45 focus, but not independently representative of it.
- Measures **stated intent** (hypothetical usefulness and willingness to pay), not **observed behavior** (actual usage, actual payment, actual upload completion) — this gap is the single biggest reason the A4 revenue figures should be treated as optimistic, not forecast.
- Did not test the actual v1 build or actual vernacular-language conversation quality — respondents reacted to a described concept, not the working prototype, so A5.4's feature-priority findings are about *stated interest*, not *usability*.

**Scope note, bridging A and C:** the case above argues for a fuller AI-portfolio-manager vision (multi-language chat, subscription pricing). What FinBuddy actually ships as this assignment's v1 (Part C) is the highest-priority slice the survey itself points to — a deterministic risk quiz and a real, cited fund-recommendation engine — plus the ability to attach an image, PDF, or text file to a message, which the model reads directly (there is no dedicated OCR pipeline that parses a statement photo into a structured, editable holdings table — that is out of scope for v1 and is not claimed here). Multi-language chat and paid conversion were also deliberately not built for v1, consistent with A5.4's finding that language ranked lowest among survey priorities and consistent with keeping a free, ungated class assignment free of a paywall.



## Part B — Features Beyond the myAI6 Base

**Baseline configuration** (not new capability, but what makes this FinBuddy rather than the generic template): assistant identity and scope rewritten in `config.ts` (`AI_NAME`, `AI_DESCRIPTION`, `WELCOME_MESSAGE`, `KB_SCOPE`); full guardrail rewrite in `prompts.ts` (`GUARDRAILS_PROMPT`, `RISK_PROFILE_PROMPT`) scoping the assistant to Indian retail-investor financial literacy and encoding the SEBI-safe advice boundary; a FinBuddy visual identity (mascot, wordmark, navy/blue brand palette in `app/globals.css`, welcome-hero landing screen with starter prompts); the knowledge base swapped from the template's default content to 8 original FinBuddy-specific documents.

| Feature | What the user experiences | Value-chain link it serves | Where it lives in the code |
|---|---|---|---|
| Risk-Profiling Quiz + Deterministic Scoring | A one-question-at-a-time, click-to-answer widget (not typed Q&A) scores the user into one of four risk tiers, with a SEBI-Riskometer-style gauge result card. The score is computed in code, never guessed by the model | Adoption (lowers the effort to get a personalized answer) → Impact (the user gets a concrete, repeatable risk classification instead of a vague self-assessment) | `app/api/chat/tools/score-risk-profile.ts`, `components/messages/risk-quiz-widget.tsx`, `components/messages/risk-profile-result-card.tsx`, `app/api/chat/tools/present-risk-quiz.ts` (client-side tool), `RISK_PROFILE_PROMPT` in `prompts.ts` |
| Fund Recommendations Engine | After scoring, the assistant looks up and presents 5 real, currently active Indian mutual funds for that risk tier — real allocation %, 3Y/5Y returns, riskometer, expense ratio, actual disclosed holdings, cited source — instead of the model naming funds from memory | Impact (concrete, comparable real examples) → Value generation (this is the moment a user can act on informed comparison, the core promise of the product) | `app/api/chat/tools/fund-recommendations.ts`, `lib/fund-recommendations-data.ts` (20 funds, 5 per tier), `components/messages/fund-recommendations-card.tsx` |
| Voice Input (Dictation) | A mic button dictates into the message box via the browser's built-in Web Speech API — no new API key, no added cost | Adoption (lowers input friction, especially on mobile) | `hooks/use-speech-recognition.ts`, wired into `app/page.tsx` |
| File / Image Attachments | Up to 3 images, PDFs, or CSV/text files per message — e.g. a screenshot of a portfolio statement — read natively by the model (images/PDFs) or folded into the message text (CSV/text) | Adoption (removes the need to manually type out portfolio details) → ties into the guardrail requiring the user to confirm any uploaded-statement holding before it's treated as fact | `lib/attachments.ts`, `app/api/chat/route.ts` (server-side validation), `config.ts` (size/count limits) |
| Live Holding Price (optional) | Tapping a real stock/REIT/InvIT holding under a recommended fund can show its live reference price via the Groww Trading API — purely a UI decoration the model never sees or narrates, so it carries none of the hallucination risk the rest of the app is built around | Impact (more concrete, current context for holdings shown) | `lib/groww-auth.ts`, `app/api/holdings-price/route.ts`, `app/api/holdings-quote/route.ts`, gated by `ENABLE_LIVE_HOLDING_PRICES` |

Design notes: the risk quiz and fund-recommendation tool are deliberately deterministic (plain TypeScript functions, not the LLM) because the single biggest observed failure mode in this class of assistant is a hallucinated number — a demo of this exact problem (a misspelled stock name triggering a fabricated return forecast) is documented in C6 and is the reason the second guardrail layer exists on top of the tools themselves. Voice input and attachments were deliberately built on browser-native/already-available APIs (Web Speech API, native file reading) rather than a new paid service, keeping the cost model unchanged. The live-holding-price feature was deliberately left optional/off-by-default and fails silently, since it is the one feature that depends on a third-party trading account the team may not always have active — a decision to keep the core product working even if that dependency is unavailable.

---

## Part C — Technical Documentation

### C1. Architecture

```
User (browser, any device)
    │
    ▼
Next.js 16 frontend (app/page.tsx, ai-elements/, messages/)      [inherited from myAI6, restyled]
    │  useChat() — AI SDK v6, streaming
    ▼
app/api/chat/route.ts  (Next.js API route, Vercel serverless)    [inherited, extended]
    │
    ├─▶ Moderation check (MODERATION_PROVIDER: llm | openai | off)      [inherited]
    ├─▶ Rate limiting (20 req/min/IP)                                   [inherited]
    ├─▶ Attachment validation (size/count caps)                         [added]
    │
    ▼
Claude (Anthropic, claude-haiku-4-5 default) via @ai-sdk/anthropic      [inherited]
    │  tool-calling loop (MAX_STEPS = 8)
    ├─▶ vectorDatabaseSearch → Pinecone (parent-child + propositions)   [inherited, new KB content]
    ├─▶ webSearch → Exa (SEBI/AMFI/RBI-preferred sources)               [inherited]
    ├─▶ presentRiskQuiz (client-side tool, no execute)                  [added]
    ├─▶ scoreRiskProfile (deterministic scoring)                        [added]
    ├─▶ fundRecommendations (deterministic lookup)                      [added]
    └─▶ holdingsPrice / holdingsQuote → Groww API (optional)            [added]
    │
    ▼
Streamed response + citations + structured result cards → browser
```

Conversation state (messages, feedback, compaction summaries) is stored client-side in `localStorage` (`lib/storage.ts`) — no server-side database, inherited from the template.

### C2. Knowledge Base

**Sources** (all original content, committed at `RAGloader/content/text/`):
- `glossary-financial-terms-en-hi.md` — English–Hindi glossary of core terms (SIP, expense ratio, direct vs. regular plans, asset allocation)
- `mutual-fund-categories.md` — SEBI's mutual fund categorization
- `sebi-investor-protections-plain-english.md` — plain-language summary of SEBI investor protections
- `strategy-risk-parity.md`, `strategy-core-satellite.md`, `strategy-endowment-style.md` — three allocation-strategy explainers
- `real-world-allocation-benchmarks.md` — real, cited allocation data from mutual funds mapped to risk tiers
- `real-world-pms-and-family-office-strategies.md` — real PMS and family-office allocation strategies, similarly mapped

**Selection:** content was chosen to directly back the two things the assistant is allowed to say without becoming investment advice — the general concept explanations (glossary, categories, protections, strategy frameworks) and the risk-tier allocation benchmarks that the guardrails explicitly permit citing after the risk quiz.

**Ingestion** (`RAGloader/RAG_loader_pipeline.ipynb`, using `RAGloader/myAI6_RAG.py`): parent-child chunking (parents ~3,000 characters for context, children ~500 characters for precise matching, 200/80-character overlap respectively), LLM enrichment per chunk (Claude writes search metadata), proposition extraction (each chunk decomposed into atomic facts as a secondary index), and local keyword extraction (KeyBERT). Credentials are read from environment variables / an interactive prompt (`_get_secret()` helper) rather than hardcoded — see C6 for why this changed mid-project.

**Retrieval configuration** (`config.ts`): Pinecone index `myai6`, three namespaces (`children`, `parents`, `propositions`), top-k = 20 children + 15 propositions per search, minimum relevance score 0.1 (kept low to catch acronym/abbreviation queries), up to 2 knowledge-base searches per response (`MAX_KB_SEARCHES`). `KB_SCOPE` in `config.ts` tells the model what's actually indexed so it knows when to search versus rely on the deterministic tools instead.

**Retrieval quality checks:** inline citations are verified against the actually-retrieved source text (`CITATION_CLAIM_MATCH_RATIO = 0.6` — the claim preceding a citation must share 60%+ of its significant words with the cited source), shown to the user as a green checkmark in the Sources box when verified. `[ ]` team: add any manual retrieval spot-checks you ran (sample queries and whether the right document surfaced).

### C3. How Each New Feature Was Built

**Risk-Profiling Quiz + Scoring** — A fixed 5-question questionnaire (`RISK_PROFILE_PROMPT`, verbatim, so wording can't drift session to session) is presented one question at a time by a client-side tool (`presentRiskQuiz`, no `execute` — it renders `RiskQuizWidget` and waits for a click). Once complete, `scoreRiskProfile` sums point values in plain TypeScript, applies two suitability caps (a "would sell everything after a 20% fall" answer floors the result at Conservative regardless of the raw score; "can't absorb even a 10% loss" does the same), and returns a structured result rendered as `RiskProfileResultCard` (an SVG gauge, not the model describing the result in prose). Non-obvious decision: the score bands were rebalanced from an even 5/10/15/20-point split to the actual bell-curve distribution of possible answer combinations, because the naive split put 66.5% of all outcomes in "Moderate."

**Fund Recommendations Engine** — `lib/fund-recommendations-data.ts` hardcodes 20 real, currently active funds (5 per tier) with real allocation, 3Y/5Y returns, riskometer level, expense ratio, and each fund's actual disclosed top holdings (verified by hand against NSE listings, out to roughly 60% cumulative portfolio weight). `fund-recommendations.ts` is a pure lookup tool — given a tier, it returns that tier's 5 funds; the model never generates a fund name or number itself. Non-obvious decision: the tool is wired as a *required* step immediately after scoring (not an optional follow-up) after an earlier version of the prompt let the model skip straight to presenting a raw allocation range without ever citing real examples.

**Voice Input** — `hooks/use-speech-recognition.ts` wraps the browser's `SpeechRecognition`/`webkitSpeechRecognition` API directly; the mic button only renders when `isSupported` is true, so unsupported browsers see no broken control. Dictated text is appended to whatever's already typed rather than replacing it.

**File / Image Attachments** — `lib/attachments.ts` classifies each file (image / pdf / text) and either turns it into a native `FileUIPart` (images, PDFs — Claude reads these directly) or folds its text content into the message body (CSV/plain text, since the chat API has no generic "document" concept for that). Both the client (`lib/attachments.ts`) and the server (`app/api/chat/route.ts`) independently enforce a per-file size cap (2MB) and per-message file count (3), sized so the combined request stays under Vercel's ~4.5MB serverless body limit once base64 overhead is accounted for.

**Live Holding Price** — `lib/groww-auth.ts` implements Groww's Trading API TOTP auth by hand (RFC 6238, via Node's built-in `crypto`) rather than adding a dependency. It's called only when `ENABLE_LIVE_HOLDING_PRICES=true` and both `GROWW_API_KEY`/`GROWW_TOTP_SECRET` are set; any missing credential or upstream failure returns `null`, and callers degrade to "no live data" rather than throwing — deliberately, since this is a paid third-party dependency the team may not always have active.

### C4. Interface and Experience

Tied to the A2 audience (a first-time investor who wants a fast, low-friction answer, likely on a phone): a welcome-hero landing screen with six starter-prompt cards replaces a blank composer for the very first turn, lowering the "what do I even ask" barrier; the sidebar groups past conversations by recency (Today / Previous 7 Days / Older) with inline rename and delete-confirm, so returning users can find a past risk-profile result without re-running the quiz; a mic and paperclip button sit directly in the composer rather than behind a menu, since voice and photo-of-a-statement are the two lowest-friction ways this audience is likely to provide information; dark mode (a header toggle, backed by `next-themes`) and a FinBuddy navy/blue brand palette (light and dark variants) replace the template's neutral default styling. Response-level affordances — copy, regenerate the last reply, edit-and-resend a message — were added so a user isn't stuck retyping a whole question after a small mistake (the same class of mistake, a misspelled holding name, that caused the hallucination bug in C6).

### C5. Behavior and Guardrails

The assistant's scope is fixed in `prompts.ts`: `GUARDRAILS_PROMPT` establishes a hard line that it never recommends buying, selling, or holding a specific security, with two narrow, explicitly-bounded exceptions — a structured asset-class allocation recommendation, and naming real example funds — both gated strictly on having just completed the risk-profile quiz, and both required to be cited from real data rather than generated. It never gives an entry price, stop-loss, or target price for any security under any framing (this is licensed investment-research activity under SEBI's Research Analyst Regulations, which the assistant is not registered for). Off-topic or disallowed requests are declined plainly, with the same tone-of-voice used for genuine questions. Prompt-injection attempts ("ignore previous instructions", "reveal your system prompt", claimed admin access) are explicitly covered and refused.

Citations are inline (`CITATIONS_PROMPT`) and verified programmatically against the retrieved source text before being shown with a green checkmark, rather than trusted on the model's word. Moderation runs before the chat model sees a message (`MODERATION_PROVIDER=llm` by default — a fast classifier on the utility model; `MODERATION_FAIL_POLICY="closed"` blocks requests if the moderation service itself is unavailable, rather than failing open). Rate limiting is on (20 requests/minute/IP).

Two guardrail changes were made after real testing surfaced gaps (see C6 for the full story): a rule requiring the assistant to flag and confirm any holding name — typed or from an uploaded statement — that doesn't match the knowledge base, the fund dataset, or a retrieved source, rather than silently assuming it knows what the user means; and a rule banning any return/downside estimate for an individual stock even when framed as a "range" or "scenario," since that framing was found to slip past the original entry/target-price ban.

### C6. Testing and Known Limitations

**A real failure case found and fixed:** during testing, a user typed "Wari Energies" (meaning Waaree Energies, a real listed company) asking how to rebalance around it. The assistant did not recognize the misspelling, silently treated it as a real security, and went on to fabricate a return/downside forecast for it ("12–15% if the sector does well, -25% to -30% if it crashes") — a specific-security forecast that the existing entry/target-price rule already banned in spirit, but not in this exact framing. Root cause: the guardrails covered *prices* but not *return ranges*, and covered *uploaded-statement* holdings but not *typed* ones. Fixed by adding the two guardrail rules described in C5, and verified against the original transcript.

**Testing with people outside the team:** 10 testers outside the project team used the live app and reported issues directly — Anish, Aditi, Dhruv, Yash, Jay, Himanshu, Shreya, Akriti, Neelakshi, and Ashi.

| # | Tester | Issue found | Fix applied |
|---|---|---|---|
| 1 | Anish | Typed a misspelled security name ("Warree" for a real fund/stock); the assistant didn't flag it as unrecognized | Same root cause as the Waaree/Wari case above — fixed via the UNVERIFIED HOLDING NAMES guardrail rule (C5), which now requires the assistant to say it doesn't recognize an unmatched name and ask the user to confirm before treating it as real, rather than silently guessing or fabricating an analysis around it. Not a fuzzy-matching or spell-check feature — a guardrail-level confirmation step |
| 2 | Aditi | Responses felt too long and verbose for a quick question | Tightened response-length guidance in the prompt so short questions get shorter answers |
| 3 | Dhruv | Felt the risk/allocation output looked generic rather than tailored to their answers | Confirmed the risk-profile quiz scores each user's actual quiz answers into one of four tiers (`scoreRiskProfile`, deterministic, no fixed template) — this was a real gap at the time of testing, closed as the quiz and scoring engine were completed |
| 4 | Yash | Wanted a clear summary of the recommendation, not just raw numbers | Added a plain-language summary alongside the fund/allocation data in the response |
| 5 | Jay | Felt the assistant was too narrow when asking about adjacent topics like budgeting or how investment gains are taxed | Reviewed against the strict financial-scope guardrail in C5 rather than loosening it — the security-specific ban (no buy/sell/price calls) is a fixed line for regulatory reasons and was not changed. Confirmed adjacent financial-literacy topics such as budgeting and tax-on-gains already fall within scope and are answered; the gap was in phrasing/coverage, not the scope boundary itself |
| 6 | Himanshu | Wanted to see funds compared side by side rather than described one at a time | The fund-recommendations response presents all 5 tier-matched funds together as comparison cards (`FundRecommendationsCard`) |
| 7 | Shreya | Could not get useful answers in a regional (non-English) language | Confirmed as a known limitation, not fixed (see below) — no locale-specific prompt variants exist in v1 |
| 8 | Akriti | No way to rename an ongoing chat | Added inline chat rename in the sidebar (`conversation-sidebar.tsx`) |
| 9 | Neelakshi | The assistant's name/branding wasn't clear in the interface | Added the FinBuddy name, wordmark, and brand palette throughout the UI (`config.ts` `AI_NAME`, welcome message, styling) |
| 10 | Ashi | Didn't know what to ask when starting a new chat | Added a welcome screen with starter-prompt cards for the first turn (`WelcomeHero`, `lib/starter-prompts.ts`) |

**What still fails or degrades:**
- Regional (non-English) language understanding remains unreliable — FinBuddy has no locale-specific prompts in v1; this is an acknowledged gap, not a claimed fix (see A5.4, where the team's own survey data suggests this may be a lower priority than originally assumed, though the sample itself may not be representative enough to settle that).
- The risk-profile quiz and fund dataset cover the four SEBI-style risk tiers only, with no concept of goal-based planning (e.g. retirement vs. a 2-year house down payment).

**What we would build next, with another week:**
- Regional-language input understanding and response generation.
- A wider, more representative round of user testing to validate the risk-profile scoring across more diverse profiles.
- Expanded financial-literacy topic coverage (budgeting, tax basics) with clearer signposting in the UI, without loosening the security-specific guardrail boundary.

**Other known limitations:**
- Two credentials (Pinecone, Unstructured.io) that were briefly hardcoded in `RAGloader/RAG_loader_pipeline.ipynb` earlier in development were removed and the code now reads them from the environment instead (see the "Stop hardcoding API keys" commit), but the old values remain in this repository's git history and should be treated as compromised until rotated in each provider's dashboard — tracked here rather than silently ignored.
- Live holding prices depend on an optional, paid Groww Trading API subscription and are off by default; without it the fund cards work identically minus that one decoration.

### C7. Running and Deploying

**Environment variables** (names only — see `env.template` for the full annotated list):
- Required: `ANTHROPIC_API_KEY`
- Optional: `OPENAI_API_KEY`, `PINECONE_API_KEY`, `EXA_API_KEY`, `FIREWORKS_API_KEY`, `GROWW_API_KEY`, `GROWW_TOTP_SECRET`, `SUMMARY_HMAC_SECRET`, `HEALTH_CHECK_TOKEN`
- Feature switches: `ENABLE_VECTOR_SEARCH`, `ENABLE_WEB_SEARCH`, `ENABLE_LIVE_HOLDING_PRICES`, `MODERATION_PROVIDER`

**Local setup:**
```bash
git clone <this repo>
cd myAI6-private
npm install
cp env.template .env.local   # fill in your own keys
npm run dev
```

**Deployment pipeline:** this repo is connected to Vercel (`myai6-private` project); every push to `main` triggers an automatic production build and deploy to `myai6-private.vercel.app`. Environment variables are set once in Vercel's project settings (Settings → Environment Variables, scoped to Production) rather than committed anywhere. Rate limiting and moderation are enabled by default and were kept on throughout.

---

## Part D — Team and Disclosure

### D1. Team and Contribution Matrix

**Team FinBuddy:** Mihira Navva, Mahak Kalani, Mudita Agarwal, Pratham Gupta

| # | Task | What it covers | Primary contributor | Secondary contributor |
|---|---|---|---|---|
| 1 | Product ideation and scoping | Stakeholder, the one job the assistant does, what it will not do, USP and positioning (A1, A2, A3) | Mahak Kalani | Mudita Agarwal |
| 2 | Business case and value model | Use → Adoption → Impact → Value generation, assumptions, sources, metrics, owners, value owner (A4) | Mudita Agarwal | Mahak Kalani |
| 3 | Knowledge base | Sourcing and licensing check, ingestion with `RAGloader`, retrieval configuration, retrieval quality checks (C2) | Pratham Gupta | Mihira Navva |
| 4 | Feature 1: Risk-Profiling Quiz + Deterministic Scoring | Design and implementation of the deterministic risk quiz and scoring engine (Part B, C3) | Mihira Navva | Mahak Kalani |
| 5 | Feature 2: Fund Recommendations Engine | Design and implementation of the real, cited fund-recommendation lookup engine (Part B, C3) | Pratham Gupta | Mudita Agarwal |
| 6 | Prompts, behavior, and guardrails | `config.ts`, `prompts.ts`, refusals and off-topic handling, citations, moderation settings (C5) | Mihira Navva | Mahak Kalani |
| 7 | Interface and user experience | Layout, components, suggested prompts, language, accessibility (C4) | Pratham Gupta | Mihira Navva |
| 8 | Testing and quality assurance | Test questions, tests with users outside the team, failure cases found and fixed (C6) | Mihira Navva | Pratham Gupta |
| 9 | Deployment and operations | Repository setup, Vercel deployment, environment variables, rate limiting, spending limit, uptime through the course (3.4, 3.5, C7) | Pratham Gupta | Mihira Navva |
| 10 | Documentation | Writing and editing `DOCUMENTATION.md` and `README.md` | Mahak Kalani | Mudita Agarwal |
| 11 | Project coordination | Work plan, task split, timeline, LMS submission, collaborator access for the instructor | Mudita Agarwal | Mahak Kalani |

**How the load balances out**

| Member | Primary (rows) | Secondary (rows) | Total credits |
|---|---|---|---|
| Mahak Kalani | 2 (rows 1, 10) | 4 (rows 2, 4, 6, 11) | 6 |
| Mudita Agarwal | 2 (rows 2, 11) | 3 (rows 1, 5, 10) | 5 |
| Pratham Gupta | 4 (rows 3, 5, 7, 9) | 1 (row 8) | 5 |
| Mihira Navva | 3 (rows 4, 6, 8) | 3 (rows 3, 7, 9) | 6 |

Every row carries exactly one primary and one secondary contributor, and every member is primary on at least one row. Reviewed together by all four team members and signed off as an accurate reflection of actual contributions before submission.


### D2. Generative AI Disclosure

> We used Claude (Anthropic, primarily via Claude Code / Cowork) as our main AI tool — for coding the assistant's features, debugging, prompt and guardrail design, and drafting this documentation. We used ChatGPT selectively for review and refinement, particularly to sharpen the business proposition in Part A. We used Gemini ("Nano Banana") to generate the FinBuddy logo and other visual/UI assets. Ideation — the core product idea, target audience, and positioning — was entirely our own; AI tools were used to refine and execute that idea, not originate it. We estimate AI contributed **~55-60%** of the total work by effort, concentrated in coding, drafting, and design execution. All product decisions, business-case assumptions, and final conclusions are our own, and we reviewed and tested every AI-assisted step before moving forward — including manually verifying fund data and NSE ticker symbols against primary sources, and testing the guardrail fixes against the real failure case described in C6.

---

