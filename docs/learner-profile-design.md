# FinBuddy: understand the learner before searching

Implemented locally, 11 October 2026. No paid LLM, Pinecone, or Exa calls were used for verification.

## What now happens

The beginner card and a small set of generic beginner messages open a four-step form before sending any chat request. The user chooses familiarity, a learning topic, language, and explanation style. Each choice is optional through Skip. The first lesson follows the chosen topic. Specific questions such as “What is a SIP?” remain direct; learning preferences are available under the composer.

Preferences are scoped to the current conversation. They stay in page memory by default; explicit opt-in stores a separate localStorage record for that chat. Expired records are rejected and removed when accessed after 30 days; this is lazy expiry, not guaranteed background erasure on an unused device. Editing, deletion, and a generated .md export are available in Learning preferences. Deleting a conversation removes its stored learning profile. The export records topics opened, not proof of comprehension. Existing chat-history storage still persists messages under the app's existing policy; profile opt-in controls only the new preference record.

Only four validated enum values go to the selected provider. No arbitrary Markdown, financial amounts, account identifiers, or inferred investor category enter this profile. Language delivery remains model-dependent. No claim is made that a preference profile improves factual accuracy by a measurable probability.

The server also returns a deterministic clarification for recognised generic beginner requests without preferences, before provider/environment setup, moderation or search. It still runs deterministic governance reconciliation and audit logging. Because no model compliance block exists on this static path, existing reconciliation conservatively queues the record; the policy has not been weakened to hide this gap.

## Search costs

Basic learning turns expose the knowledge base but no web-search tool. One KB tool call is allowed per turn. Explicit current-information or search requests can expose web search, with at most one web call and two KB calls, capped further by administrator settings. Request-scoped counters count failures and reserve a slot before awaiting work, so concurrent retries cannot evade the limit. One KB call can still involve multiple Pinecone operations and parent expansion; this is not a promise of one external request or zero retrieval cost. Parent character caps remain intact.

No results means explain the evidence gap, not invent an answer. This routing is a conservative English keyword policy, not semantic intent classification; multilingual and implicit recency requests may require clarification. Provider token cost is still incurred for the actual lesson. The four onboarding questions themselves incur none.

## Background database plan

Use authenticated PostgreSQL/Supabase for cross-device profiles, with structured JSON as canonical data and Markdown generated for export. Vercel recommends external storage for persistent writes rather than writing user .md files into deployed functions ([Vercel guidance](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions)). Keep private learning records out of the repository and shared Pinecone educational index.

A proposed migration is in database/learner-profiles.sql. It includes owner+conversation keys, strict preference checks, consent/version timestamps, expiry, authenticated grants, and per-operation row-level policies. Owner A must never read/write owner B's records; Supabase describes grants plus RLS as the database access controls ([official documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)). The SQL has not been applied or executed against PostgreSQL here.

To connect it: add sign-in, show a separate cloud-storage consent notice, verify the session server-side, bind the owner from that session, validate writes using the same strict schema, and load only unexpired records. Implement authenticated read/update/delete/export endpoints; never accept a browser-supplied owner identity as authority. Use a user-scoped database token so RLS remains active; never expose a service-role key. Add expiry cleanup and documented deletion/backups handling. Test two accounts and anonymous requests for every operation before release. A B2B deployment also needs a server-verified tenant identity and tenant+owner+conversation isolation; this single-project schema is not a completed multi-tenant banking integration.

Save optional learning-progress events separately only with a clear purpose and retention policy. A topic opened is an observation; a correct comprehension check is separate evidence. Do not label mastery from chat volume or use learning curiosity to push purchases.

## Right questions: education versus suitability

The four shipped questions answer “how should we explain this?” and do not answer “what should this person buy?”. Additional educational follow-ups can ask: Which term was unclear? Would a hypothetical example help? Can you explain diversification in your own words? Would you like to compare risk, costs, or liquidity next? Store explicit preferences rather than inferred financial facts.

For an adviser-led, legally reviewed suitability module, the proposed question domains are:

| Domain | Candidate question | Why it matters |
|---|---|---|
| Objective | What is the purpose of the money? | Goals can differ within one household. |
| Horizon | When might this money be needed? | Near-term liquidity cannot be rescued by a high tolerance score. |
| Liquidity | Could essential spending require this money unexpectedly? | Separate access needs from return aspirations. |
| Capacity | Would a loss affect essential expenses or commitments? | Ability to absorb loss differs from willingness. |
| Income and commitments | How stable are cash flows; are debt commitments causing strain? | Capacity requires context, with prior financial-data consent. |
| Behaviour | What did you do, or think you would do, during a substantial fall? | Hypothetical answers should be checked for consistency. |
| Understanding | What losses and liquidity restrictions do you understand? | Knowledge and experience are not willingness or capacity. |
| Contradictions | Does a near-term need conflict with accepting large losses? | Ask for clarification rather than averaging away a hard constraint. |

These are proposed domains, not a validated questionnaire or approved scoring formula. SEBI's investor guidance describes risk profiling and suitability as responsibilities of registered advisers ([SEBI](https://investor.sebi.gov.in/investment_advisor.html)). FinBuddy cannot become “SEBI regulated” through disclaimers or a more elaborate score alone.

The governing skill Section 5.1 says the team will “keep the quiz flow as it is”; AGENTS.md prohibits widening it without a governance update. The five-question quiz, scoring, allocations, and fund mapping remain unchanged. Expanding that exception requires Governance-admin sign-off and a changelog row. The earlier product review's short-horizon counterexample remains unresolved in that fixed quiz; this learning-profile change does not fix suitability. Financial amounts also need the separate Section 9.1 consent flow; remembering learning preferences is not that consent.

## Validation scope

Offline tests cover all 135 preference combinations, malformed/injected headers, isolated per-chat storage, opt-in, expiry, deletion, blocked storage, no-web overrides, and 100 concurrent search attempts. Existing governance/risk/citation tests remain part of the suite. Mocked browser checks exercise the beginner form, request headers, new-chat isolation, and a short-phone layout. Real provider answer quality and hosted database policies need a separate budgeted, authorised evaluation; they were not paid for here.

Verification result: 230 tests passed across 10 files; TypeScript and diff checks passed. Full lint still reports existing any/ref/effect findings in the chat files; comparison against HEAD confirmed the two remaining React ref errors also occur in the baseline. New profile/tool files passed targeted lint. Browser screenshots were inspected after animation completion. The real local beginner endpoint returned HTTP 200 with a clarification and compliance data, without tool calls or provider keys.
