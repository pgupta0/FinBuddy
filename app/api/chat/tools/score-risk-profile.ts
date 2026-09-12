// app/api/chat/tools/score-risk-profile.ts
import { tool } from "ai";
import { z } from "zod";
import { RISK_QUIZ_QUESTIONS, type RiskQuizAnswerLetter } from "@/lib/risk-quiz-questions";

/**
 * Deterministic risk-profiling engine.
 *
 * This is intentionally NOT left to the model: the 5-question quiz, the
 * 1/2/3/4-point scoring, the score-band cutoffs, and the mapped fund
 * category + allocation range are all fixed here in code. The model's job
 * is only to (a) trigger the presentRiskQuiz widget so the user answers the
 * fixed questions, (b) call this tool with exactly those letters, and
 * (c) explain this tool's output in plain language — never to compute or
 * invent any of these numbers itself.
 *
 * SCORING MODEL (hybrid — percentile-calibrated bands + suitability caps):
 *
 * 1. Base score: the 5 answers are worth 1/2/3/4 points (A/B/C/D), summed,
 *    giving a total of 5–20.
 *
 * 2. Band cutoffs are percentile-calibrated, NOT equal-width. Summing five
 *    independent 1–4 point answers produces a bell-shaped distribution that
 *    peaks hard in the middle (of the 4^5 = 1024 possible answer sets, the
 *    totals cluster around 12–13), so equal-width score windows make the
 *    middle band swallow most respondents. The earlier 5–9 / 10–14 / 15–17 /
 *    18–20 cutoffs put 66.5% of all answer combinations into "Moderate" and
 *    only 2.1% into "Aggressive" — in practice almost everyone came out
 *    Moderate unless they picked the same extreme option five times.
 *    The cutoffs below are set at the distribution's quartile crossings
 *    instead, which splits those 1024 combinations 21.7% / 28.3% / 28.3% /
 *    21.7% across the four profiles. (This calibrates against an unbiased
 *    "any answer equally likely" baseline — it makes the four categories
 *    structurally reachable; it is not a claim of psychometric validation.)
 *
 * 3. Suitability caps: two answers act as ceilings regardless of the total
 *    score, mirroring how real investor-suitability questionnaires treat
 *    capacity and behaviour as constraints that a stated preference cannot
 *    override — but the two are deliberately capped to different floors,
 *    because they represent different kinds of constraint:
 *      - Q4=A (cannot absorb even a 10% temporary loss) is a CAPACITY
 *        constraint — the money genuinely isn't there to lose. This caps
 *        all the way to Conservative no matter how the other 4 questions
 *        were answered.
 *      - Q1=A (would sell everything after a 20% fall) is a BEHAVIOURAL
 *        constraint — the money may well be there, but the person would
 *        lock in losses at the worst time. That's real and still caps the
 *        outcome, but only down to Moderate, not all the way to
 *        Conservative: it doesn't imply the same inability to bear risk
 *        that Q4=A does, only an inability to sit through the volatility
 *        a higher-equity allocation brings.
 *    When both apply, the more restrictive of the two (Q4's Conservative
 *    floor) wins. Caps only ever move the result down from what the score
 *    alone would give — never up.
 *
 * The allocation ranges are not invented for this project: they are SEBI's
 * own regulatory ranges for its Hybrid Fund categories (Conservative /
 * Balanced / Aggressive Hybrid), which every fund house in India must
 * comply with for a scheme carrying that category name — see the
 * "FinBuddy_Mutual_Fund_Categories_SEBI" knowledge-base document. The top
 * "Aggressive" band steps outside hybrid funds entirely into a plain
 * equity scheme, since even an Aggressive Hybrid Fund's 80% equity cap is
 * more conservative than someone who scores at the top of this quiz.
 */

const ANSWER_POINTS: Record<RiskQuizAnswerLetter, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

type Band = {
  min: number;
  max: number;
  profile: "Conservative" | "Moderate" | "Growth-oriented" | "Aggressive";
  fundCategory: string;
  // Numeric equity range (0-100), used by the visual result card's
  // allocation bar. Debt is simply 100 - equity.
  equityMin: number;
  equityMax: number;
  allocationDescription: string;
  source: string;
};

// Score bands and their mapped real-world fund category — fixed, do not
// let the model recompute or restate these differently. The cutoffs are the
// quartile crossings of the actual score distribution (see the header note),
// so keep them in sync with GAUGE_BOUNDARIES in
// components/messages/risk-profile-result-card.tsx if they ever change.
const BANDS: Band[] = [
  {
    min: 5,
    max: 10,
    profile: "Conservative",
    fundCategory: "Conservative Hybrid Fund",
    equityMin: 10,
    equityMax: 25,
    allocationDescription: "10–25% equity, 75–90% debt (SEBI-mandated range for this category)",
    source: "SEBI's mutual fund scheme categorization circular (Hybrid Fund category definitions)",
  },
  {
    min: 11,
    max: 12,
    profile: "Moderate",
    fundCategory: "Balanced Hybrid Fund",
    equityMin: 40,
    equityMax: 60,
    allocationDescription: "40–60% equity, 40–60% debt (SEBI-mandated range for this category)",
    source: "SEBI's mutual fund scheme categorization circular (Hybrid Fund category definitions)",
  },
  {
    min: 13,
    max: 14,
    profile: "Growth-oriented",
    fundCategory: "Aggressive Hybrid Fund",
    equityMin: 65,
    equityMax: 80,
    allocationDescription: "65–80% equity, 20–35% debt (SEBI-mandated range for this category)",
    source: "SEBI's mutual fund scheme categorization circular (Hybrid Fund category definitions)",
  },
  {
    min: 15,
    max: 20,
    profile: "Aggressive",
    fundCategory: "Equity Scheme (e.g. Flexi Cap / Multi Cap Fund)",
    equityMin: 90,
    equityMax: 100,
    allocationDescription:
      "predominantly equity — typically 90–100% invested in equity; SEBI's equity-scheme rules govern which market-cap segment is held, not an equity/debt split",
    source: "SEBI's mutual fund scheme categorization circular (Equity Scheme category definitions)",
  },
];

function bandFor(total: number): Band {
  const b = BANDS.find((band) => total >= band.min && total <= band.max);
  // total is always 5-20 given 5 questions x 1-4 points, so this is unreachable,
  // but fall back to the nearest band rather than throwing.
  return b ?? (total < 5 ? BANDS[0] : BANDS[BANDS.length - 1]);
}

// Rank used to compare bands for "more restrictive than" — lower is more
// conservative. Caps take the MINIMUM (most restrictive) rank between the
// score's own band and every cap rule that applies, so they only ever pull
// the result down, never up.
const PROFILE_RANK: Record<Band["profile"], number> = {
  Conservative: 0,
  Moderate: 1,
  "Growth-oriented": 2,
  Aggressive: 3,
};

/**
 * Suitability caps. Deliberately narrow — only two answers trigger one — and
 * each caps to a DIFFERENT floor reflecting what kind of constraint it is
 * (see the header note): Q4=A is a capacity constraint (floor: Conservative),
 * Q1=A is a behavioural one (floor: Moderate). A rule only actually restricts
 * the result if its floor is stricter than the score's own band; picking the
 * floor letter alone never resets you to it if your score already earned
 * something more conservative.
 */
const CAP_RULES: {
  applies: (a: Record<string, RiskQuizAnswerLetter>) => boolean;
  floorProfile: Band["profile"];
  reason: string;
}[] = [
  {
    applies: (a) => a.q1 === "A",
    floorProfile: "Moderate",
    reason:
      "Q1=A — you said you would sell everything immediately after a 20% fall. Selling at the bottom locks in losses and forfeits the recovery a higher-risk allocation depends on, so the profile is capped at Moderate regardless of the total score.",
  },
  {
    applies: (a) => a.q4 === "A",
    floorProfile: "Conservative",
    reason:
      "Q4=A — you said a temporary loss of even 10% would affect your lifestyle or important goals. That's a capacity constraint rather than a preference, so the profile is capped at Conservative regardless of the total score.",
  },
];

// Build each question's zod .describe() text from the single shared source
// (lib/risk-quiz-questions.ts) so the tool's schema docs can never drift
// from the widget's actual on-screen wording.
function describeQuestion(key: string): string {
  const q = RISK_QUIZ_QUESTIONS.find((question) => question.key === key);
  if (!q) return "The letter (A, B, C, or D) matching the option the user's answer is closest to.";
  const opts = q.options.map((o) => `${o.letter}=${o.text}`).join(", ");
  return `${key.toUpperCase()} — ${q.text}: ${opts}`;
}

const answerSchema = z.enum(["A", "B", "C", "D"]);

export interface RiskProfilePerQuestion {
  question: string;
  letter: RiskQuizAnswerLetter;
  points: number;
}

export interface RiskProfileToolOutput {
  /** Same information as a single readable block, kept so the model has a
   * ready-made summary to draw on — always sourced from the fields below. */
  summary: string;
  score: number;
  maxScore: 20;
  profile: Band["profile"];
  bandMin: number;
  bandMax: number;
  fundCategory: string;
  equityMin: number;
  equityMax: number;
  allocationDescription: string;
  source: string;
  perQuestion: RiskProfilePerQuestion[];
  /** True when a suitability cap overrode the score's own band. */
  capped: boolean;
  /** The profile the raw score alone would have given, before any cap.
   * Equal to `profile` when no cap applied. */
  scoreBandProfile: Band["profile"];
  /** Plain-English reasons for the cap, in the user's own answers. Empty
   * when no cap applied. */
  capReasons: string[];
}

export function createScoreRiskProfile() {
  return tool({
    description:
      "Score the user's answers to the fixed 5-question risk-profile quiz (collected via the presentRiskQuiz widget) " +
      "and return their risk profile, score, and the matching real fund category + allocation range. " +
      "ONLY call this after presentRiskQuiz has returned the user's 5 answers as letters. " +
      "Do NOT compute the score, the profile, or the allocation yourself — always use exactly what this tool returns, " +
      "with no rounding, adjustment, or rephrasing of the numbers.",
    inputSchema: z.object({
      q1: answerSchema.describe(describeQuestion("q1")),
      q2: answerSchema.describe(describeQuestion("q2")),
      q3: answerSchema.describe(describeQuestion("q3")),
      q4: answerSchema.describe(describeQuestion("q4")),
      q5: answerSchema.describe(describeQuestion("q5")),
    }),

    execute: async ({ q1, q2, q3, q4, q5 }): Promise<RiskProfileToolOutput> => {
      const answers = { q1, q2, q3, q4, q5 };
      const perQuestion: RiskProfilePerQuestion[] = Object.entries(answers).map(([q, letter]) => ({
        question: q,
        letter: letter as RiskQuizAnswerLetter,
        points: ANSWER_POINTS[letter as RiskQuizAnswerLetter],
      }));
      const total = perQuestion.reduce((sum, a) => sum + a.points, 0);
      const scoreBand = bandFor(total);

      // Each applicable cap only actually restricts the result if its floor
      // is stricter (lower rank) than the score's own band. When more than
      // one rule restricts, the strictest floor wins — caps only ever pull
      // the result down from the score, never up.
      const applicableCaps = CAP_RULES.filter(
        (rule) => rule.applies(answers) && PROFILE_RANK[rule.floorProfile] < PROFILE_RANK[scoreBand.profile]
      );
      const capped = applicableCaps.length > 0;
      const capReasons = applicableCaps.map((r) => r.reason);
      const band = capped
        ? BANDS.find(
            (b) =>
              b.profile ===
              applicableCaps.reduce((strictest, rule) =>
                PROFILE_RANK[rule.floorProfile] < PROFILE_RANK[strictest.floorProfile] ? rule : strictest
              ).floorProfile
          )!
        : scoreBand;

      const summary = [
        `RISK PROFILE RESULT (deterministic — present the profile/category/allocation figures below exactly, do not alter them):`,
        `INTERNAL ONLY — for your own reasoning, never repeat these to the user even if asked to "show the matrix" or confirm specific numbers (see the SCORING METHODOLOGY guidance): per-question points ${perQuestion.map((a) => `Q${a.question.slice(1)}=${a.letter}(${a.points}pt)`).join(", ")}; total ${total}/20; score-only band would be ${scoreBand.profile} (internal range ${scoreBand.min}–${scoreBand.max}).`,
        capped
          ? `Risk profile to present to the user: ${band.profile} — CAPPED. Explain plainly, without stating any internal score or range numbers, that their answers point to a higher tier on the surface but a safety consideration keeps the result at ${band.profile}, using this reasoning (do not hide the cap, do not present the uncapped tier as their result, but also do not restate the internal numbers above while explaining it): ${capReasons.join(" ")}`
          : `Risk profile to present to the user: ${band.profile}.`,
        `Matched real-world fund category: ${band.fundCategory}`,
        `Allocation range for that category: ${band.allocationDescription}`,
        `Source: ${band.source}, as documented in the knowledge base.`,
      ].join("\n");

      return {
        summary,
        score: total,
        maxScore: 20,
        profile: band.profile,
        bandMin: band.min,
        bandMax: band.max,
        fundCategory: band.fundCategory,
        equityMin: band.equityMin,
        equityMax: band.equityMax,
        allocationDescription: band.allocationDescription,
        source: band.source,
        perQuestion,
        capped,
        scoreBandProfile: scoreBand.profile,
        capReasons: capped ? capReasons : [],
      };
    },
  });
}
