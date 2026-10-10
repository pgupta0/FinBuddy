// Shared governance text. Imported by the system prompt, the chat route and the
// client, so the wording the model is told to use and the wording the app
// falls back to can never drift apart. Source: governance/advice-boundary-skill.md
// Sections 7.2, 7.3 and 9.

// Client-safe: imported by components, so no server-only imports here.

/** Skill Section 7.3 — full footer for every substantive answer. */
export const STANDARD_DISCLAIMER =
  "FinBuddy provides general financial education, not investment advice. It is not a SEBI-registered Investment Adviser or Research Analyst. Mutual fund investments are subject to market risks; read all scheme-related documents carefully. Consider consulting a SEBI-registered adviser before investing.";

/** Skill Section 7.3 — short form for purely conceptual follow-ups. */
export const SHORT_DISCLAIMER = "Educational information only, not investment advice.";

/** Skill Section 9.1 — consent request before using personal financial figures. */
export const CONSENT_PROMPT =
  "To explain how your savings are spread across asset types, I'll use the numbers you share **only in this conversation**, to generate an educational comparison. I won't use them to recommend products. You can skip this and still use FinBuddy. Do you agree? (Yes / No)";

/** Skill Section 6, I-2. */
export const PII_REPLY =
  "Please don't share identifiers like PAN or account numbers; I don't need them.";

/**
 * Skill Section 9.4 — grievance contact. The skill leaves the contact details
 * for the team to fill in; set GRIEVANCE_CONTACT in the environment. Until it
 * is set, the placeholder below is shown, which is deliberately visible so the
 * gap is not silently shipped.
 */
export const GRIEVANCE_CONTACT =
  process.env.GRIEVANCE_CONTACT?.trim() ||
  "the FinBuddy Grievance Officer (contact details to be published by the team; we aim to respond within 30 days)";

/**
 * Skill Section 7.2 — the safe Educational Redirect the app shows in place of a
 * draft that the deterministic checks found to contain advice (a RED that the
 * model did not catch). Generic on purpose: it must be correct for any
 * question.
 */
export const WITHHELD_REDIRECT = `I can't tell you what to buy, sell or hold, or which fund to pick, because that would be personalised investment advice, and FinBuddy isn't a SEBI-registered adviser.

What I can do is help you compare options yourself. Investors usually look at a fund's category and benchmark, its expense ratio, how concentrated its top holdings are, how closely it has tracked its benchmark over long periods, and its SEBI risk-o-meter level. I'm happy to explain any of these, or walk through a fund's publicly disclosed portfolio.

For a recommendation based on your situation, you can consult a SEBI-registered Investment Adviser. You can verify an adviser's registration on SEBI's website.

*${STANDARD_DISCLAIMER}*`;
