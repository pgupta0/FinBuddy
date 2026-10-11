# FinBuddy evaluation runbook

This is an engineering evaluation guide, not the governing advice-boundary skill. It does not authorise personalised advice, change risk scoring, or override governance/rules.json.

1. Run npm test. Capture the JSON reporter with npm test -- --reporter=default --reporter=json --outputFile=docs/offline-test-results.json.
2. Run npx tsc --noEmit and lint changed files. Distinguish existing lint failures from introduced failures rather than suppressing the project's rules globally.
3. Run the local app, then node scripts/offline-ui-evaluation.cjs with Playwright installed or PLAYWRIGHT_MODULE_PATH pointing to its package. FINBUDDY_BROWSER_CHANNEL defaults to msedge; set it for another installed browser. FINBUDDY_TEST_URL must be localhost. Optional FINBUDDY_SCREENSHOT_DIR saves previews. The harness mocks /api/models and /api/chat and blocks other origins; mocked catalog entries do not imply real provider availability.
4. Inspect screenshots after animations, including light/dark, 320 px width, landscape, and focus navigation. Automated geometry checks are not a WCAG certification or a real-user usability study.
5. Review corpus provenance, source dates, assumptions, formula outputs, and live-index parity. A citation string or source-match check is not factual verification.
6. Run the 1024-combination risk diagnostic. Its assertions characterise existing behaviour, including known defects; they do not validate investor suitability.
7. Before any paid evaluation, set an explicit spend cap and use a small stratified dataset (basics, ambiguity, Hindi/Hinglish, sources, stale evidence, prohibited advice, distress, PII, injections). Measure input/output tokens, tool counts, latency, costs, grounding, and human-reviewed safety. Do not silently call paid providers from offline tests.

## Evaluation matrix

Engineering evaluation weights in lib/evaluation/scorecard.ts: safety 30%, grounding 25%, usability 15%, privacy 15%, efficiency 10%, learning 5%. These are proposed priorities, not empirically calibrated probabilities. Suitability scores and investor allocations never use them. Score only measured criteria, record the sample/denominator, and leave missing evidence unmeasured. Incomplete coverage yields no total score. A high average never clears a critical safety/privacy/provenance failure; the helper blocks a release when such a failure is recorded. A candidate score is not certification or legal approval.

Separate business outcomes should include comprehension improvement, successful explanation without support escalation, cost per resolved learning session, and voluntary return visits. Do not optimise the assistant for purchases, risky trades, inferred wealth, or product pitches.

## Proposed changes to the governing skill — review required

Section 5.1 says to “keep the quiz flow as it is”; Section 13 and AGENTS.md require Governance-admin sign-off and a changelog row for changes to the governing skill or deterministic rules. This runbook records proposals only:

- Replace uniform-answer percentile calibration with an adviser-reviewed instrument, separate capacity/tolerance/horizon/knowledge axes, contradiction handling, and validated hard constraints. Do not assign arbitrary new percentages to simulate validation.
- Review all twenty curated scheme source links: they point to Groww, while R-7 names primary AMFI/AMC disclosures. Obtain dated primary evidence, archive it with hashes/licensing metadata, reconcile figures, and then approve the dataset refresh.
- Review the recency rule against SEBI's 8 May 2026 circular, effective 1 July 2026. It specifies a 30-day educational price-data lag subject to conditions. The current three-month governance text is stricter and stale; do not loosen it automatically. Source: https://www.sebi.gov.in/sebi_data/attachdocs/may-2026/1778242522289.pdf
- Define reviewed deterministic server clarifications in the policy so the absence of a model self-check does not create false-positive review work; keep actual checks and audits.
- Add manual Hindi/Hinglish safety cases: English regex checks alone cannot establish multilingual output compliance.

No governance skill/rules, quiz questions/weights, category mappings, or exception scope were modified in this evaluation.
