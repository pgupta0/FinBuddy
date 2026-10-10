# FinBuddy product review and B2B roadmap

FinBuddy has a useful education foundation: a shared provider registry, deterministic quiz and fund lookup, reranking before bounded parent expansion, citation canonicalization, PII masking, and model/code compliance reconciliation. The best next product is a concise, auditable learning companion embedded in a partner platform. Personalized recommendations need a separate approved advisory operating model.

## Scope and validation

Review date: 11 October 2026, India time. This review covers local code and public primary sources. The Vercel configuration, deployed UI, bank accounts, live model behavior and Pinecone index contents were not inspected. No paid model, embedding, reranking or search API calls were made. Unit tests are code checks, not proof of legal compliance, suitability or production load capacity.

Baseline: 186 tests passed. After changes: 198 tests across nine files passed, including an exhaustive sweep of all 1,024 five-question answer combinations. The sweep verifies arithmetic, allocation bounds and the two existing caps. It does not validate whether those bands predict real investor behavior.

## Improvements implemented

- Visible answers target 80–160 words; requested deep dives target 250–400. Mandatory qualifications, dates, disclaimers and necessary citations take precedence. These are prompt targets, not guaranteed output lengths.
- Single-concept answers usually use one or two authoritative sources, retaining additional evidence when needed. Existing citation numbering and the complete collapsed source list remain intact.
- Generation allowance is 4,000 tokens per step, including the compliance block. Explicit numeric thinking budgets are added: low 1,024, medium 2,048, high 4,096. Adaptive and level-based thinking remain within the generation allowance; live provider behavior needs a small later check.
- Tool loops use four steps instead of eight; the soft web-search allowance is one instead of three. Retrieval candidate counts and parent bounds remain unchanged to avoid an unmeasured recall regression.
- Anthropic/Haiku is the project default, with key-aware Gemini fallback. The model picker defaults on, as requested, and only lists configured providers. Existing Vercel environment overrides still apply, including DEFAULT_VENDOR and ENABLE_MODEL_PICKER.
- The landing screen leads with learning, removes the action slogan, and offers clearer beginner entry points. The asset-class starter no longer asks where the user should invest. The terminology starter asks about one concept.
- Answer text, reasoning, score/fund cards and citations wait for the server verdict in the normal UI. Copy/export excludes unchecked drafts. Static moderation refusals carry a verdict. Historical messages lacking a verdict are hidden and require regeneration.
- Source check wording now explains that lexical overlap is not independent factual verification.

The display gate is a client safeguard. The server still streams model text before onFinish checks it; network clients and browser storage may receive that text. Bank-grade deployment needs server-side withholding and sanitized persistence. This change does not establish zero unsafe content reaching all clients.

## Priorities before a bank pilot

| Priority | Finding | Required improvement |
|---|---|---|
| Critical | Quiz exception is pending Governance-admin approval | Resolve the operating model and sign-off before presenting it as approved suitability assessment |
| Critical | Final checks happen after model text enters the response stream | Buffer substantive drafts server-side, validate them, then send only released content; keep interactive quiz events separate |
| High | Consent relies substantially on prompt/model state | Implement explicit server-verified consent, purpose and withdrawal state before personal financial analysis |
| High | Browser history stores message objects | Minimize and redact persistent messages, remove withheld drafts, offer deletion and documented retention |
| High | Quiz ignores time horizon as a hard constraint | Redesign under approved governance; validate against expert-labeled cases |
| High | Audit storage is optional and review queue requires real operations | Require durable storage for pilots, reviewer authentication, access controls, decisions, retention and alerting |
| High | Grievance contact has a placeholder fallback | Publish a real contact, process and response timeline |
| Medium | Source checks use word overlap | Evaluate claim support and contradictory figures; show data date and missing evidence clearly |
| Medium | Search allowances are prompt guidance | Enforce per-tool counters and per-tenant token/spend quotas in code |

A disclaimer does not decide whether personalized product matching is regulated advice. SEBI’s education association clarification distinguishes education from prohibited advice and performance claims. The quiz’s scope and bank distribution need qualified legal/compliance review. [SEBI association clarification](https://www.sebi.gov.in/web/?file=https%3A%2F%2Fwww.sebi.gov.in%2Fsebi_data%2Fattachdocs%2Fjan-2025%2F1738152590849.pdf). Review the current [2026 Investment Advisers master circular](https://www.sebi.gov.in/legal/master-circulars/feb-2026/master-circular-for-investment-advisers_99569.html) before release. No regulatory certification is asserted here.

## Risk questionnaire redesign for approval

Current counterexample: answers D/A/D/D/D can produce Aggressive despite Q2 saying the money is needed within one year. A summed score lets unrelated answers offset a critical constraint. Equal representation of arbitrary answer combinations is not psychometric validation. Experience also does not automatically imply financial capacity.

Proposed design: a short readiness screen followed by adaptive questions, with separate capacity, tolerance, knowledge and goal dimensions. Ask only necessary ranges, after consent; offer skip and “not sure” choices. Do not ask for PAN, account numbers or exact income. Proposed topics:

1. Age eligibility and whether the person is learning or seeking regulated advice.
2. One goal and its time horizon, rather than a single profile for every goal.
3. Need for withdrawals and flexibility of the goal date.
4. Emergency reserves in months of essential expenses.
5. Debt/payment strain and income stability using broad ranges.
6. Ability to absorb a permanent loss, separate from temporary volatility.
7. Willingness to tolerate a fall and the emotional response to it.
8. Understanding of diversification, liquidity and the possibility of loss.
9. Concentration in existing asset classes, only with consent.
10. A neutral comprehension check and contradiction review.

Capacity constraints should not be averaged away by enthusiasm or experience. Contradictions and missing answers should produce “assessment incomplete” and clarification, not a confident tier. A registered advisory partner must approve any product matching, allocation methodology, human review and recordkeeping. The fixed five-question flow and scoring were not expanded in this patch because governance Section 5.1 keeps that exception scoped and pending sign-off.

## Retrieval and deterministic finance architecture

Keep the LLM as a language interface: retrieve evidence, select permitted tools and explain validated results. Perform arithmetic, date checks and policy decisions in deterministic services. Do not describe an LLM confidence score as a calibrated probability of investment success.

Retain the existing prose profile as the baseline: about 1,600-character parents, 380-character children, rerank before parent expansion. Use one glossary entry per semantic section; preserve a table’s headers, units and disclosure date together. Store authoritative URL, issuer, effective date, disclosure month, jurisdiction, language, version and content hash. Separate regulations, definitions and dated fund data. These are starting parameters to evaluate, not universally optimal chunk sizes.

Create a small English/Hindi/Hinglish retrieval set with expected documents and answers. Include TER synonyms, fund category boundaries, conflicting disclosures, missing data, stale data and unknown terms. Compare baseline with fewer retrieved parents and improved lexical matching using saved or synthetic fixtures before changing the live index. Measure recall@k, irrelevant context, dated-source correctness and answer support. More context does not automatically improve accuracy; long-context positional weaknesses are documented in [Lost in the Middle](https://arxiv.org/abs/2307.03172).

Next deterministic tools can explain contribution totals, inflation-adjusted purchasing power, fees, descriptive concentration and hypothetical drawdowns. All inputs, formulas, units, rounding and assumptions must be visible. Use validated historical series for volatility/correlation and maximum drawdown; do not invent estimates from fund names. Scenario outcomes must be labeled hypothetical, without expected-return promises or recommended portfolio weights. Broader asset education needs approved content first; tax, insurance, foreign assets and other jurisdictions need distinct expert-reviewed boundaries.

## Bank integration and commercial model

Proposed flow: partner’s authenticated app → partner gateway → FinBuddy tenant/session policy → approved content retrieval and deterministic tools → output validation → educational response and audit events. Product execution stays in the bank’s authorized workflow. A named bank integration has not been built or agreed.

Start with a branded learning component or server API using short-lived signed sessions. Bind tenant identity to verified server credentials, isolate retrieval namespaces and logs, restrict embedding origins, enforce per-tenant quotas, and provide audit exports and deletion hooks. Support bank-managed credentials or deployment where requested, least-privilege access, incident handling and a documented exit plan. Bank outsourcing due diligence includes security, oversight and contractual controls under the [RBI IT outsourcing directions](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12486). DPDP implementation should use the official rules and phased commencement timeline, reviewed by the partner’s privacy team. [MeitY rules and timeline](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digit).

Axis documents API plans, access requests and testing in its [developer portal](https://apiportal.axisbank.com/portal/support). Kotak describes API banking and UAT/production onboarding in its [bank presentation](https://images.kotak.com/bank/mailers/2022/files/Startup%20Current%20Account%20Presentation.pdf). These establish potential technical routes, not permission to embed FinBuddy inside their consumer apps. Embedding requires a commercial/product partnership and security review.

Sell a time-limited education pilot to digital banking, wealth education or customer experience teams. Package a sandbox demo, architecture and data-flow diagram, evaluation results, compliance decision log, support plan and capped pricing proposal. Suggested pricing structure: implementation fee plus platform fee and capped usage allowance; validate willingness to pay in discovery interviews instead of inventing a market price. Differentiate through bilingual education, evidence freshness, predictable cost and reviewer controls.

Measure learning completion, comprehension improvement, helpfulness, support deflection, latency and cost per resolved question. Investment conversion should not be the primary optimization objective: encouraging unsuitable investing would undermine the education proposition.

## Efficient evaluation plan

Local repeatable checks: npm test and npx tsc --noEmit. The suite covers deterministic governance, masking, citations, routing, caching, signing, scoring, generation budgets and display/export behavior. It does not invoke provider generation.

Next add mocked stream tests for missing verdicts, interrupted responses, tool chains, moderation refusals, 429 errors and Redis failure, then load-test a mock endpoint at increasing concurrency. Measure memory, error rate and p95 latency; these results describe application overhead only.

Only after setting a rupee/token ceiling, run a small live evaluation with one model and a dozen representative prompts. Log input, output, reasoning and cached tokens, tool calls, word count, unique citations, first-response latency and compliance outcome. Compare concise answers against the baseline with human scoring. Do not run automated paid stress tests without a bounded budget.

Proposed acceptance gates: no withheld draft displayed or stored; correct provenance for every numerical fund claim; unknown data produces an explicit gap; required consent is enforced; all critical adversarial cases pass; answer length and cost meet pilot targets. Code tests and expert review are both necessary. Deployment, visual browser review and live retrieval checks remain separate release steps.


## Homepage refinement and next experiments

The revised homepage uses one headline, one supporting sentence, a small mascot, and six focused beginner journeys. The default provider selector is restored. Header, content and composer share a flex layout, so the composer no longer spans under the desktop sidebar. Local visual checks at 1366×768, 390×844 and 320×568 show all six choices without scrolling or horizontal overflow; the shortest phone layout hides secondary hints visually but keeps complete accessible button labels. Browser zoom and exceptionally short viewports may still require scrolling.

The proposed sequence is basics → SIPs → asset types → risk → fund costs → the existing five-question quiz. This is a design hypothesis to validate with first-time users, not a demonstrated conversion improvement. The first tile is visually distinguished as “Start here.” Advanced strategy comparisons can appear after users learn the basic terms. Do not add many more homepage tiles solely to advertise feature count. Recognition-based labels reduce the need to already know what to ask; show advanced choices later using progressive disclosure. [NN/G recognition and recall](https://www.nngroup.com/articles/recognition-and-recall/), [NN/G progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/).

Potential later topics are “Read a fund factsheet,” “Understand diversification,” “KYC and account basics,” and “Spot investment scams.” Add them only with reviewed, indexed content and a distinct learning purpose. A “More topics” view can support these without increasing the first screen’s density. Compare card titles with users who have never invested: can they predict what each click will teach, distinguish risk education from the quiz, and find the starting choice without assistance?

Next experiments: measure first-click choice, whether the answer matches the card’s promise, useful follow-up rate and a simple comprehension check. Offer a language choice and a brief/deeper explanation control only when those preferences work consistently end to end. Consider topic suggestions after each answer, while avoiding prompts that steer purchases. Test keyboard focus, contrast, enlarged text and reflow against [WCAG 2.2](https://www.w3.org/TR/WCAG22/); the checks in this patch are not a complete accessibility audit.

The provider menu was visually tested with a synthetic Anthropic/Gemini catalog and selection persisted correctly. The real local endpoint reported no configured models; production options depend on Vercel provider keys. No provider generation calls were made. If the deployment explicitly sets ENABLE_MODEL_PICKER=false, set that operational switch to true to allow the restored menu.
