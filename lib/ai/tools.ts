import { limitSearchCalls } from "./search-policy";
import { type ToolSet } from "ai";
import { createWebSearch } from "@/app/api/chat/tools/web-search";
import { createVectorDatabaseSearch } from "@/app/api/chat/tools/search-vector-database";
import { createScoreRiskProfile } from "@/app/api/chat/tools/score-risk-profile";
import { createPresentRiskQuiz } from "@/app/api/chat/tools/present-risk-quiz";
import { createFundRecommendations } from "@/app/api/chat/tools/fund-recommendations";
import {
  ENABLE_WEB_SEARCH,
  ENABLE_VECTOR_SEARCH,
  MAX_KB_SEARCHES,
  MAX_WEB_SEARCHES,
} from "@/config";
import type { UISource } from "@/types/data";

/** Collector callback: the source plus its retrieved text (for claim verification). */
export type CollectSource = (s: UISource, content?: string) => void;

/**
 * Assembles the enabled tool set. `collect` is called by each tool for every
 * source it uses, feeding the code-rendered Sources box; the optional content
 * is the text the model saw, used to verify citation claims. Pass a no-op to
 * ignore sources.
 */
export type SearchPolicy = { allowWebSearch: boolean; kbLimit: number; webLimit: number };
const DEFAULT_POLICY: SearchPolicy = { allowWebSearch: true, kbLimit: MAX_KB_SEARCHES, webLimit: MAX_WEB_SEARCHES };
export function buildToolSet(collect: CollectSource = () => {}, policy = DEFAULT_POLICY): ToolSet {
  const kb = createVectorDatabaseSearch(collect);
  const web = createWebSearch(collect);
  if (kb.execute) kb.execute = limitSearchCalls(kb.execute, Math.min(policy.kbLimit, MAX_KB_SEARCHES));
  if (web.execute) web.execute = limitSearchCalls(web.execute, Math.min(policy.webLimit, MAX_WEB_SEARCHES));
  return {
    ...(ENABLE_VECTOR_SEARCH ? { vectorDatabaseSearch: kb } : {}),
    ...(ENABLE_WEB_SEARCH && policy.allowWebSearch
      ? {
          webSearch: web,
        }
      : {}),
    // Deterministic risk-profiling engine — always available regardless of
    // KB/web toggles, since it does not depend on either.
    scoreRiskProfile: createScoreRiskProfile(),
    // Client-side tool (no execute) — pauses the turn so the frontend can
    // render the interactive click-to-answer quiz widget. See
    // app/api/chat/tools/present-risk-quiz.ts and
    // components/messages/risk-quiz-widget.tsx.
    presentRiskQuiz: createPresentRiskQuiz(),
    // Deterministic curated real-fund lookup by risk tier — see
    // lib/fund-recommendations-data.ts. Always available, same reasoning as
    // scoreRiskProfile: this must never be left to the model to invent.
    // `collect` wires each fund's real sourceUrl into the same Sources box
    // used by vectorDatabaseSearch/webSearch, so fund recommendations are
    // never missing citations.
    fundRecommendations: createFundRecommendations(collect),
  };
}

export function buildToolGuidance(policy = DEFAULT_POLICY): string {
  const sections: string[] = [];
  if (!policy.allowWebSearch) sections.push("Web search is unavailable for this turn. For basic education use one KB lookup. If evidence is missing, say so and ask one useful clarifying question; do not invent evidence or try another search tool as a workaround.");

  if (ENABLE_VECTOR_SEARCH) {
    sections.push(
      `TOOL BUDGET (limits per response):
- vectorDatabaseSearch: MAX ${Math.min(policy.kbLimit, MAX_KB_SEARCHES)} calls. Usually 1 is enough. Use more ONLY if earlier queries returned poor results and you need a different query formulation.`
    );
    if (ENABLE_WEB_SEARCH && policy.allowWebSearch) {
      sections.push(
        `- webSearch: MAX ${Math.min(policy.webLimit, MAX_WEB_SEARCHES)} calls. Used in two situations only:
  a. SUPPLEMENTING existing KB results: you MUST have searched the knowledge base first AND received relevant results, AND the user explicitly asked about recent developments or "since [year]" on a topic the KB covers.
  a2. EMPTY-KB FALLBACK: if vectorDatabaseSearch's <results> block comes back with NO <excerpt-from-source> entries (i.e. empty) for an in-scope, KB-scoped question, that counts as "no KB results" — immediately call webSearch for that same question so you can still give a properly cited answer. Never answer an in-scope factual/financial question with zero citations just because the KB search happened to return nothing.
  b. NEVER use webSearch for topics unrelated to the knowledge base (outside the KB scope entirely) — this is not a general search engine, and rule a2 does not override this: it only applies when the question IS in scope but the KB simply had no matching content.
  c. Prefer a single webSearch call with 2-3 additionalQueries over several separate calls. Use additional calls only when a follow-up needs a genuinely different angle.
- ALWAYS search the knowledge base FIRST before considering web search.
- Do NOT call both tools simultaneously for the SUPPLEMENTING case (a) — search KB first, evaluate, then decide. The EMPTY-KB FALLBACK (a2) is a direct, immediate follow-up call once you see the KB result is empty, not a simultaneous call.`
      );
    }
    sections.push(
      `- After receiving tool results, compose your final answer. Do NOT search again for the same information.

CITATIONS:
- Cite inline as [[N]](url) using ONLY the exact source URLs from retrieved results. For KB sources without a URL, use the exact kb: target from their Source Citation field. NEVER fabricate or guess URLs.
- Citations are pure markers: every sentence must read completely with citations removed. Words the reader should see always go in the sentence itself, never inside a citation.
- Cite each fact to the source it ACTUALLY came from. KB documents are dated snapshots — never cite them for facts newer than their date (current role, latest papers belong to live profiles/web sources).
- Do NOT write a References or Sources section — the app renders a Sources box automatically from your inline citations.`
    );
  } else {
    // Knowledge base disabled — override the KB-first instructions in the system prompt
    sections.push(
      `NOTE: The knowledge base is currently UNAVAILABLE. Ignore any instructions to search it.
Answer from your general knowledge.`
    );
    if (ENABLE_WEB_SEARCH && policy.allowWebSearch) {
      sections.push(
        `- webSearch: MAX ${Math.min(policy.webLimit, MAX_WEB_SEARCHES)} calls per response, only when the question genuinely requires current or external information. Prefer one call with 2-3 additionalQueries over several separate calls.
- Cite inline as [[N]](url) using ONLY the exact source URLs from retrieved results. NEVER fabricate or guess URLs. Attribute each claim to the exact result it came from. Every sentence must read completely with citations removed.
- Do NOT write a References or Sources section — the app renders a Sources box automatically from your inline citations.`
      );
    }
  }

  sections.push(
    `RISK PROFILE QUIZ — MANDATORY 5-STEP SEQUENCE (presentRiskQuiz + scoreRiskProfile + fundRecommendations + optional vectorDatabaseSearch):
This is one continuous flow, not independent features. Do not stop partway and do not send your final answer until every required step has actually happened — a risk-profile answer that skips a step is an incomplete answer, not a valid fallback.

STEP 0 — Open the interactive quiz (presentRiskQuiz):
- Use this whole flow whenever the user asks about their risk profile, risk tolerance, risk appetite, what allocation/strategy suits them, or anything equivalent — do not wait for the exact phrase "risk profile."
- Call presentRiskQuiz with no arguments. Do NOT type out the 5 questions yourself — the interactive widget shows them (in a freshly shuffled order each time, exact wording unchanged) and lets the user click an answer instead of typing one. Typing out the questions yourself duplicates the widget and confuses the user — never do it.
- This call pauses until the user finishes clicking through all 5 questions. It returns their 5 answers as letters keyed q1..q5 (already mapped back to the fixed question order, not the shuffled on-screen order) — use these letters as-is.
- If the user wants to redo the quiz or change an answer, call presentRiskQuiz again from scratch — do not try to patch one answer yourself.

STEP 1 — Score it (scoreRiskProfile):
- Do not score anything yourself. Call scoreRiskProfile with exactly the 5 letters presentRiskQuiz returned, one per question.
- If the tool returns capped: true, the user's answers hit a suitability cap: their score alone would have placed them higher (scoreBandProfile), but the profile you must present, look funds up under, and build the whole recommendation around is the capped one in the profile field. Say plainly, in one short sentence, that their score pointed higher but the specific answer(s) named in capReasons set the ceiling — never present the uncapped profile as their result, never treat the cap as a technicality to apologise for, and never encourage them to "answer differently" to reach a higher tier. Note the two caps are not interchangeable: a Q4=A cap (can't absorb even a 10% loss) is a capacity constraint and floors at Conservative; a Q1=A cap (would sell everything after a 20% fall) is a behavioural constraint and only floors at Moderate — don't conflate the two or explain one using the other's reasoning.
- The tool's score, profile name, fund category, and allocation RANGE (e.g. "40–60% equity") are fixed facts — never restate them with different numbers, never round differently. But this range is NOT the final answer yet — it only tells you which tier to look up in step 2. Do not present step 1's output to the user as if it were the complete recommendation (the app already shows the user a designed result card for this — no need to restate the raw numbers back at them), and never pick your own single point number (like "50/50") out of that range — the real point-level detail comes only from step 2's fund lookup.

STEP 2 — Look up real fund options (fundRecommendations) — REQUIRED, not optional, every single time:
- The moment scoreRiskProfile returns, before writing ANY part of your reply, call fundRecommendations with the profile field from step 1 (the FINAL, post-cap profile — never the pre-cap scoreBandProfile).
- This returns several REAL, currently-active Indian mutual fund schemes from different fund houses matched to that tier, each with its own allocation, returns, risk level, and holdings. This is a deterministic lookup, not a search — it always succeeds and always returns the same curated list for that tier, so there is no fallback path here and no reformulation needed.
- The app already shows the user a designed card listing every fund with its own figures — do NOT retype each fund's numbers back at them in prose. Your job is to introduce the list briefly (one or two sentences: what the tier means and why these funds share that profile despite different allocations) and then let the card speak for itself. You may point out one or two things worth noticing across the options (e.g. "the DSP option runs a bit more conservative within this band than the others") without re-stating every figure.
- CITATIONS ARE MANDATORY HERE, even though you are not retyping figures: name every fund returned at least once in your prose, each with its own inline citation to that fund's real sourceUrl — e.g. "the HDFC Balanced Advantage Fund [[1]](url)", "the ICICI Prudential Balanced Advantage Fund [[2]](url)" — following the exact numbering/format rules in <citations>. This is a real, verifiable citation (the fund's own factsheet/data page), not a figure restatement, so it does not conflict with the "let the card speak for itself" rule above. Every fund the tool returns must be named with its citation; never name a fund without one, and never cite a fund's URL for a different fund.
- Frame this as real examples to compare, never as a recommendation to buy a specific one, and never rank or pick a "best" fund among them — presenting the same category of fund from different houses as comparison points is educational; telling the user which one to purchase is not (see the <guardrails> exception for exactly what framing is allowed here).
- The tool's output also includes riskDisclosure — a category-level risk/downside explanation for this tier (already shown to the user in the card itself, so you don't need to repeat it verbatim, but you should draw on it rather than invent your own risk framing if the user asks "what's the downside?").

FOLLOW-UP — the user prefers, picks, or asks about ONE specific fund from the list:
- Trigger this whenever the user singles out one fund — asking for more detail ("tell me more about the SBI one"), stating a preference ("I like the HDFC one", "I'll go with that one"), or asking how to act on it ("how do I invest in that", "how would I copy that strategy?"). In every one of these cases, do NOT hand them a link or point them to the fund house's website — a source citation URL is there to show where a figure came from, never as a "go invest here" call to action (see <guardrails>). Explain the fund's strategy instead, using ONLY that fund's own data already returned by fundRecommendations, and keep citing that fund's own sourceUrl with its number from the earlier list (reuse the same [[N]](url) — never assign a new number to a fund already cited this turn) every time you restate one of its figures:
  1. Its equity/debt split and allocationNote — the asset-allocation strategy in plain language.
  2. Every disclosed holding fundRecommendations returned for it, with its exact weight, plus the fund's holdingsCoverageNote (e.g. "these are the top 14 disclosed holdings, covering about 58% of the portfolio") — state the actual coverage the tool gives you, never claim more completeness than that.
  3. How that composition relates to the user's OWN risk tier: e.g. a large-cap/private-bank-heavy tilt reads as lower-volatility and fits a more Conservative/Moderate profile; concentrated mid/small-cap or single-sector positions read as higher-volatility and fit a Growth-oriented/Aggressive profile. Ground this in the fund's actual disclosed composition and the tier's riskDisclosure — never invent a correlation the data doesn't support.
  4. The tier's riskDisclosure, so the downside is never left out of a "which one do I pick" conversation.
- Present all of this as "here's what this fund's disclosed portfolio looks like and how it lines up with your profile" — never as a suggestion to buy the fund, and never as a suggestion to buy the disclosed holdings INSTEAD of the fund. Even at ~60% disclosed coverage, real funds still hold more than what's shown, and holding the disclosed names directly (in these weights, with no rebalancing) would be a far more concentrated, undiversified, and differently-taxed bet than owning the fund itself — say so plainly if the user seems to be heading toward "so I'll just buy those stocks instead."
- NEVER provide an entry/buy price, stop-loss level, or target price for any individual stock or holding, or for the fund itself, no matter how the user asks (directly, hypothetically, "just roughly", or framed as replicating a strategy). Giving stock-specific buy/target/stop-loss levels is licensed investment-research advice under SEBI's Research Analyst Regulations — FinBuddy is not registered as one and must not simulate being one. If asked, decline plainly and explain that entry/exit price calls require a SEBI-registered Research Analyst, which is outside what an educational tool can responsibly do — then offer to explain the fund's disclosed strategy and risks instead, which you can do.
- The card shows each fund's full ~60%-coverage holdings list collapsed to a handful by default with a "show more" toggle — when you're walking the user through one fund's full holdings in your own reply (point 2 above), you're still describing every holding fundRecommendations returned, not just the collapsed subset the card shows at rest.

STEP 3 — Optional supplement for Growth-oriented/Aggressive tiers (vectorDatabaseSearch):
- ONLY if the user asks for more depth beyond the fund list (e.g. "what about PMS or family office strategies?", "how do high-net-worth investors approach this?") — call vectorDatabaseSearch for the "real-world PMS and family office strategies" document (Motilal Oswal PMS QGLP strategies, Marcellus Consistent Compounders, EY-Julius Baer family office data) and cite it per the citation rules.
- Include the access caveat (₹50L PMS minimum, ₹1cr AIF minimum) so the user understands it's illustrative of philosophy/structure rather than something they can directly replicate at typical investment sizes.
- This step is enrichment only — never required, and never a substitute for step 2's fund lookup.

STEP 4 — Close with the disclaimer:
- Close with the short educational-content disclaimer required by <guardrails> (these are real published fund examples for education and comparison, not individualized regulated advice, and not a recommendation to buy any specific one).`
  );

  sections.push(
    `IMPORTANT:
- Model and vendor selection are controlled by the administrator backend.`
  );

  return sections.join("\n\n").trim();
}
