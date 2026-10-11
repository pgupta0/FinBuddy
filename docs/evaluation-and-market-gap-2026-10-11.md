# FinBuddy evaluation and market opportunity — 11 October 2026

## Decision

The app is a useful education prototype, with improvements below verified offline. It is not yet ready to be represented as a compliant banking investment-advice engine. Passing regression tests measures covered behaviour; it does not establish model accuracy, investment suitability, regulatory approval, or market demand. No paid Gemini, Anthropic, Pinecone, or Exa calls were made. No production deployment or cloud database change was made.

## Evidence and limits

| Area | Evaluation | Result and interpretation |
|---|---|---|
| Automated code | Full Vitest suite, machine-readable report | 278 tests passed across 13 files; see offline-test-results.json. Includes governance, citations, routing, token caps, input validation, privacy and retrieval fixtures. |
| UI/UX | 34 browser assertions across 1366×768, 768×1024, 390×844, 320×568 and 844×390, light/dark | Passed. Six cards fit horizontally; standard-height views need no content scroll. Short landscape can scroll. Model choice, four-step onboarding, remember/reload, export/delete, skip and new-chat isolation passed. Screenshots inspected at phone and desktop sizes. |
| Answer display | Mock approved/pending/withheld replies and adversarial source URL | Approved text displays; pending/withheld drafts and their sources stay hidden. Unsafe source URL is plain text. These synthetic replies do not measure actual provider quality. |
| Retrieval | Fake Pinecone client with 40 child candidates | Reranking precedes six-parent expansion. Cached repeat avoids new queries; optional proposition, reranker and parent failures recover; child failure is not cached; low-score children are dropped. Actual relevance/recall remains unmeasured. |
| Costs | 100 simultaneous search attempts; invalid limits; intent cases | Counters allow one paid execution in the one-call fixture; invalid budgets fail closed. Basic lessons have no web tool. One tool call can still include two Pinecone searches, reranking and a parent fetch. |
| Risk model | Exhaustive 1024 answer combinations | Final distribution: Conservative 372, Moderate 268, Growth-oriented 192, Aggressive 192. Of 256 combinations with within-one-year horizon, 58 produce Growth-oriented/Aggressive. This is a structural diagnostic, not a user prevalence estimate. |
| Fund provenance | All sourceUrl fields in curated dataset | 20/20 point to groww.in, while governing R-7 requires AMFI/AMC disclosure evidence. A real URL is insufficient to meet that source policy. Figures were not independently verified here. |
| Corpus | Eleven local Markdown files; independent fee arithmetic | The illustrative values recompute to approximately ₹39,59,141 and ₹32,43,522, difference ₹7,15,619. Dated tax and regulatory documents require current-primary-source review. The corpus is not complete across all assets/jurisdictions. |
| Security | Request schema and provider/header checks | Malformed history and browser-supplied system roles now fail before provider work. This is shape validation, not complete authentication or a penetration test. |

TypeScript and targeted lint were checked. Baseline chat lint failures remain; new code is checked separately. Browser geometry is not a WCAG audit; no real novice participants or buyer interviews were conducted. No p95 production latency, infrastructure load limit, model factual-accuracy percentage, or business conversion lift is claimed.

## Improvements applied

- Beginner detection now recognises common English and selected Hindi/Hinglish phrases; the starter card uses an exact shared constant instead of allowing arbitrary text after a trusted prefix.
- Web routing honours more no-web phrasings, avoids false recency triggers such as current liabilities, and does not expose web tools for detected recent-market-data, distress, or bypass requests. Keyword routing still misses some multilingual paraphrases; it is not a semantic classifier.
- Remembered learner records are refreshed on use, preventing an open tab from keeping expired or externally deleted records. Storage failure falls back to page memory instead of pretending persistence succeeded.
- Per-chat instructions make explanation style concrete: short main lesson, one hypothetical example, or up to three steps. Necessary disclosures and explicitly requested depth take precedence. One optional comprehension question may follow, without claiming mastery or suitability.
- The risk card no longer associates its gauge with SEBI's scheme Riskometer. It explains that the fixed quiz is not validated suitability and that liquidity/capacity need separate assessment. Its questions, scoring, thresholds, allocations and fund mapping remain unchanged.
- The fee example now labels both fee inputs as hypothetical, removes promotional plan-selection language and an unsupported assertion about regulatory rationale, and rounds the independently computed difference consistently.
- Added request-shape validation, a reusable offline UI harness, mocked retrieval failure tests, a separate weighted evaluation helper and an evaluation runbook. Updated chunking documentation to reflect eleven corpus files.

The local fee document changed; the hosted vector index was not re-ingested. That update needs the existing ingestion workflow and a budgeted verification before users can rely on the revised retrieved text.

## Weighted matrix and why risk weights were not changed

Engineering evaluation weights: safety 30%, grounding 25%, usability 15%, privacy 15%, efficiency 10%, learning 5%. These express proposed review priorities, not measured probabilities or investor allocation weights. The scorecard leaves a total unmeasured when dimensions lack evidence and blocks release for recorded critical failures regardless of average. Live answer quality, complete source validity, multilingual safety and novice comprehension are currently unmeasured: there is no defensible overall quality score.

For a future approved suitability instrument, assess capacity, tolerance, horizon/liquidity and knowledge separately. Do not equate experience with capacity or use a uniform-answer percentile distribution as a psychometric validation. Near-term cash needs and inability to absorb essential-spending losses should be reviewed as constraints before any aggregation; contradictory responses should ask for clarification. Any new weights/caps require adviser input, a validated instrument, user testing, bias checks and Governance-admin approval. The existing flaw is documented, not hidden by changing percentages until results look balanced.

## Market evidence

- [Zerodha Varsity](https://zerodha.com/varsity/) already offers free open financial lessons and mobile modules/quizzes. Competing on a generic content library alone is weak.
- [Kotak StockShaala](https://www.kotakneo.com/stockshaala/) already supplies free beginner and more advanced courses. Pitching Kotak another course catalogue is not a demonstrated gap.
- [Axis mutual-fund experience](https://www.axis.bank.in/investment/mutual-funds) combines product explanations, disclosures and a learning hub. It provides a concrete location for context-specific explanation, but does not prove that Axis wants or lacks an AI vendor.
- [SEBI Investor](https://investor.sebi.gov.in/) offers Hindi/English education and links a readiness test to a learning path. A questionnaire or bilingual content by itself is not novel.
- [RBI FREE-AI report](https://www.rbi.org.in/Scripts/PublicationReportDetails.aspx?ID=1306) recommends transparency, accessible human recourse and accountability for deploying entities. This supports a governance-oriented design direction; it is a committee report, not a claim that FinBuddy is certified or that every recommendation is a binding requirement.

**Inference to validate:** the most plausible differentiator is an embeddable explanation layer that answers a novice's immediate question from the host's approved documents, in concise language, with learning preferences, evidence dates and a human handoff. Public competitor pages cannot establish the absence of equivalent private features, willingness to pay or market size.

| Candidate buyer/use case | Suggested entry point | Value hypothesis | Validation needed |
|---|---|---|---|
| Bank/distributor | Explain expense ratio, exit load, liquidity or a disclosure term while viewing a product page | Better understanding and fewer repetitive support questions | Interviews with product/compliance/support teams; no pressure to buy |
| Broker | Explain account concepts, order terminology, concentration and fraud warnings | Fewer mistakes/confusion in onboarding | Licensed host content, no trade calls or transaction automation |
| AMC/wealth platform | Explain approved factsheet terms and category risks | More consistent disclosure comprehension | Primary monthly disclosures, provenance and human escalation |
| Workplace or education platform | Structured beginner lessons plus comprehension checks | Learning outcomes without transaction dependence | Learner interviews, consented pilots and retention evidence |

Prioritise one narrow mutual-fund terminology pilot; do not promise every asset or international investing law. A bank-specific vocabulary assistant is a smaller, more reviewable purchase than a generic “best investor model.” Charge a proposed platform fee plus capped usage/maintenance, not a fee tied to investment purchases; actual pricing must follow buyer research and measured operating costs.

## B2B integration outline

Host app → authenticated education API/widget → server-verified tenant/user scope → deterministic intent/privacy checks → tenant-approved corpus → model explanation → server-side output review → display/handoff. Learning preferences should not automatically expose holdings or financial identifiers. Finance-data consent is separate.

Before a bank pilot: add authentication/tenant isolation, a real persistent store, authorised audit-review access, retention/deletion handling, provider/subprocessor terms, incident handling and a staffed escalation path. A widget/SDK or host-controlled WebView can be a proposed delivery mechanism; no Axis/Kotak integration contract or access exists here. Keep execution and regulated advice in the host's separately approved systems.

Critical technical limitation: current code hides unreviewed drafts in the UI, but raw streamed text still reaches the browser before the final verdict. A B2B version should buffer or gate content server-side; client hiding alone is insufficient for a strict no-delivery requirement. Current audits are logs, not a completed protected review workflow.

## Governance update proposal

[SEBI's 8 May 2026 circular](https://www.sebi.gov.in/sebi_data/attachdocs/may-2026/1778242522289.pdf) specifies a 30-day lag for educational price-data sharing/usage, subject to conditions, effective 1 July 2026. The governing skill's three-month text therefore needs current review. We retained its stricter limits rather than interpreting this as permission to quote live prices.

The governing skill Section 5.1 says “keep the quiz flow as it is”; AGENTS.md requires Governance-admin sign-off and a changelog entry for skill/rule changes. Proposed changes are in evaluation/README.md. The pending quiz exception, primary fund evidence, current regulatory library and server-side gating are release concerns, not matters an evaluation average can clear.

## Next experiments — proposed, not measured results

1. Interview five novice learners and three buyer/compliance stakeholders; ask what is unclear at the product screen, what support requests repeat, and who owns purchasing/approval. No outreach was sent.
2. Run a consented pilot comparing current FAQ versus a short sourced explanation. Measure before/after comprehension, successful explanation without help, voluntary return use and cost per resolved learning session. Purchase/trade rate is not the assistant's optimisation goal.
3. Run a capped provider evaluation on 24 reviewed prompts spanning basic terms, ambiguous goals, Hindi/Hinglish, stale evidence, missing evidence, prohibited advice, distress, identifiers and injections. Record actual tokens/tool calls/latency/cost and human-reviewed source support. No such calls were made in this run.
4. Evaluate retrieval on a labelled corpus with recall@k, MRR/nDCG and context-token cost before changing reranker or proposition weights. A/B test parent caps 1600/2400 and top-N 3/6; do not deploy a smaller context solely because mock costs look lower.
5. Resolve the release concerns, then rerun the same regression suite and a real-user study before describing the app as bank-ready.

Local API verification: malformed null body, client system role and non-string text each returned HTTP 400; a generic beginner request returned HTTP 200 with a deterministic clarification. No provider request was required.

Final build validation: Next.js production compilation, TypeScript, page generation and route optimization completed successfully. The local test server was stopped after verification. No deployment was performed.
