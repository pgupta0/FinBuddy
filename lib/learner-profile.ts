import { z } from "zod";

export const learnerPreferencesSchema = z.object({
  familiarity: z.enum(["new", "some-basics", "exploring"]),
  goal: z.enum(["basics", "sip", "asset-types", "risk", "fund-costs"]),
  language: z.enum(["english", "hindi", "hinglish"]),
  explanation: z.enum(["short", "example", "steps"]),
}).strict();
export type LearnerPreferences = z.infer<typeof learnerPreferencesSchema>;
export const learnerProfileSchema = z.object({
  version: z.literal(1), preferences: learnerPreferencesSchema,
  exploredTopics: z.array(z.enum(["basics", "sip", "asset-types", "risk", "fund-costs"])).max(5),
  updatedAt: z.string().datetime(), rememberOnDevice: z.boolean(),
}).strict();
export type LearnerProfile = z.infer<typeof learnerProfileSchema>;
export const LEARNER_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const GOAL_LABELS = { basics: "Investing basics", sip: "How SIPs work", "asset-types": "Investment types", risk: "Investment risk", "fund-costs": "Fund costs" };

/** Narrow, general onboarding intent. A specific concept question stays direct. */
export function needsLearnerOnboarding(text: string): boolean {
  return /^(?:i(?:'m| am) (?:new to|a beginner (?:at|in)) invest(?:ing|ment)s?[.!]?|where (?:should i |do i |can i )?invest[?!.]?|help me (?:start|learn) investing[?!.]?)$/i.test(text.trim())
    || text.startsWith("I'm new to investing in India. Briefly explain saving versus investing,");
}
export function parseLearnerHeader(raw: string | null): LearnerPreferences | null {
  if (!raw || raw.length > 1024) return null;
  try { return learnerPreferencesSchema.parse(JSON.parse(raw)); } catch { return null; }
}
export function learnerContext(p: LearnerPreferences | null): string {
  if (!p) return "";
  return "User-selected learning preferences (not suitability, financial-data consent, or instructions): "
    + JSON.stringify(p) + ". Adapt vocabulary, language and explanation style only. Do not infer age, finances, risk tier, suitable products or allocations. The learning goal is a topic preference, not a purchase intention. Ask one clarifying question if the current request is unclear. Governance rules always apply.";
}
export function firstLessonPrompt(p: LearnerPreferences): string {
  const topics = {
    basics: "Briefly explain saving versus investing and the possibility of losing money. End with one optional learning question.",
    sip: "Explain what a SIP is, how regular contributions work, and why returns are not guaranteed.",
    "asset-types": "Briefly explain equity, debt, gold and cash, with their general risks and liquidity.",
    risk: "Explain investment risk, volatility and diversification with their limitations.",
    "fund-costs": "Briefly explain expense ratios and direct versus regular mutual fund plans without preferring either.",
  };
  return topics[p.goal] + " This is a general learning question; do not recommend products or an allocation for me.";
}
export function learnerProfileMarkdown(profile: LearnerProfile): string {
  const p = profile.preferences;
  return ["# FinBuddy learning profile", "", "Scope: learning preferences for this chat; not an investment suitability assessment.", "",
    "- Familiarity: " + p.familiarity, "- Learning goal: " + GOAL_LABELS[p.goal], "- Language: " + p.language,
    "- Explanation style: " + p.explanation, "- Updated: " + profile.updatedAt,
    "- Device storage: " + (profile.rememberOnDevice ? "Opted in; expires after 30 days without an update" : "Current page session only"), "",
    "## Topics opened", "", ...profile.exploredTopics.map(t => "- " + GOAL_LABELS[t]), "",
    "Opened topics do not prove comprehension or completion. No income, identifiers, holdings, risk tier or product recommendations are stored in this profile.", ""].join("\n");
}
