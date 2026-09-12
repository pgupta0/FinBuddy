// lib/ai/kb-keywords.ts
//
// A deterministic safety net for TOOL_CALLING_PROMPT's "always search the KB
// for in-scope questions" rule. Prompt instructions alone were not reliable
// enough: testing showed plain glossary questions (e.g. "what is SIP",
// "what is expense ratio") sometimes get answered straight from the model's
// own training knowledge, skipping vectorDatabaseSearch entirely — so no
// source is ever collected and the Sources box stays empty, even though the
// term is explicitly documented in the knowledge base.
//
// This list mirrors the real, indexed KB content (see RAGloader/content/text/
// glossary-financial-terms-en-hi.md, mutual-fund-categories.md, and the
// strategy/allocation-benchmark docs) so route.ts can force the model's FIRST
// tool-use step to be a real vectorDatabaseSearch call whenever the user's
// latest message plainly names one of these terms — removing the model's own
// judgment from the one place it was proving unreliable, the same way
// scoreRiskProfile/fundRecommendations were made deterministic instead of
// left to the model.
// Deliberately EXCLUDES "risk profile" / "risk appetite" / "risk tolerance":
// those phrases trigger the separate, higher-priority MANDATORY risk-quiz
// flow (presentRiskQuiz must be STEP 0 there, per lib/ai/tools.ts) — forcing
// vectorDatabaseSearch first would break that flow instead of helping it.
export const KB_FORCE_SEARCH_KEYWORDS: string[] = [
  // Glossary terms (glossary-financial-terms-en-hi.md)
  "sip",
  "systematic investment",
  "lump sum",
  "lumpsum",
  "stp",
  "systematic transfer",
  "swp",
  "systematic withdrawal",
  "nav",
  "net asset value",
  "expense ratio",
  "ter",
  "total expense ratio",
  "direct plan",
  "regular plan",
  "exit load",
  "folio",
  "asset allocation",
  "asset class",
  "diversification",
  "rebalanc",
  "riskometer",
  "compounding",
  "cagr",
  "xirr",
  "volatility",
  "drawdown",
  "liquidity",
  "inflation",
  "benchmark",
  "kyc",
  "know your customer",
  "amc",
  "asset management compan",
  "amfi",
  "elss",
  "index fund",
  "etf",
  "exchange-traded fund",
  "exchange traded fund",
  "arbitrage fund",
  "fund of fund",
  // Mutual fund categories (mutual-fund-categories.md)
  "mutual fund categor",
  "equity scheme",
  "debt scheme",
  "hybrid scheme",
  "hybrid fund",
  "solution-oriented scheme",
  "large cap",
  "mid cap",
  "small cap",
  "flexi cap",
  "multi cap",
  // Strategy explainers + allocation benchmarks
  "risk parity",
  "core-satellite",
  "core satellite",
  "endowment-style",
  "endowment style",
  "pms",
  "portfolio management service",
  "family office",
  // SEBI investor-protection content
  "sebi",
  "investor protection",
];

/** True if the text plainly names a KB-scoped term (case-insensitive). */
export function mentionsKbTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return KB_FORCE_SEARCH_KEYWORDS.some((kw) => lower.includes(kw));
}
