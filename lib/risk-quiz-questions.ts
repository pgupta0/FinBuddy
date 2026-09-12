// lib/risk-quiz-questions.ts
//
// SINGLE SOURCE OF TRUTH for the fixed 5-question risk-profile quiz.
//
// The exact wording and options here are used in THREE places, all derived
// from this one file so they can never drift apart:
//   1. prompts.ts        — builds the model-facing <risk_profile> reference text
//   2. score-risk-profile.ts — builds the scoreRiskProfile tool's per-question
//                              zod .describe() text
//   3. components/messages/risk-quiz-widget.tsx — the interactive click-to-answer
//                              widget the user actually sees and uses
//
// Do NOT hardcode this question text anywhere else. If the quiz ever needs to
// change, it changes here once.

export type RiskQuizAnswerLetter = "A" | "B" | "C" | "D";
export type RiskQuizQuestionKey = "q1" | "q2" | "q3" | "q4" | "q5";

export interface RiskQuizOption {
  letter: RiskQuizAnswerLetter;
  text: string;
}

export interface RiskQuizQuestion {
  key: RiskQuizQuestionKey;
  text: string;
  options: RiskQuizOption[];
}

export const RISK_QUIZ_QUESTIONS: readonly RiskQuizQuestion[] = [
  {
    key: "q1",
    text: "If your investment portfolio fell by 20% in a market downturn, what would you most likely do?",
    options: [
      { letter: "A", text: "Sell everything immediately" },
      { letter: "B", text: "Sell some investments to reduce losses" },
      { letter: "C", text: "Hold my investments and wait for recovery" },
      { letter: "D", text: "Invest more at lower prices" },
    ],
  },
  {
    key: "q2",
    text: "When will you likely need the money you are investing?",
    options: [
      { letter: "A", text: "Within 1 year" },
      { letter: "B", text: "1–3 years" },
      { letter: "C", text: "3–7 years" },
      { letter: "D", text: "More than 7 years" },
    ],
  },
  {
    key: "q3",
    text: "What is your primary investment objective?",
    options: [
      { letter: "A", text: "Protect my money / avoid losses" },
      { letter: "B", text: "Generate stable returns with limited risk" },
      { letter: "C", text: "Grow my wealth over the long term" },
      { letter: "D", text: "Maximise returns, even with significant fluctuations" },
    ],
  },
  {
    key: "q4",
    text: "How much of a temporary loss in your portfolio could you financially handle without affecting your lifestyle or important goals?",
    options: [
      { letter: "A", text: "Less than 10%" },
      { letter: "B", text: "10–20%" },
      { letter: "C", text: "20–30%" },
      { letter: "D", text: "More than 30%" },
    ],
  },
  {
    key: "q5",
    text: "Which statement best describes your investing experience?",
    options: [
      { letter: "A", text: "I have little/no investing experience" },
      { letter: "B", text: "I mainly invest in FDs, savings, or low-risk products" },
      { letter: "C", text: "I have experience with mutual funds, stocks, or ETFs" },
      { letter: "D", text: "I actively invest and am comfortable with significant market volatility" },
    ],
  },
] as const;

/** Fisher-Yates shuffle — used client-side so the quiz widget shows the
 * fixed 5 questions in a fresh random order each time, without ever
 * changing their wording, options, or their q1..q5 answer keys. */
export function shuffledQuizQuestions(): RiskQuizQuestion[] {
  const arr = [...RISK_QUIZ_QUESTIONS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
