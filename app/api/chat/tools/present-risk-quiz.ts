// app/api/chat/tools/present-risk-quiz.ts
import { tool } from "ai";
import { z } from "zod";

/**
 * Client-side tool — deliberately has NO `execute`.
 *
 * When the model calls this, the AI SDK pauses the turn and the frontend
 * (components/messages/risk-quiz-widget.tsx) renders an interactive
 * click-to-answer quiz widget: one question at a time, options shown as
 * buttons instead of free text, and the 5 fixed questions (from
 * lib/risk-quiz-questions.ts) presented in a freshly shuffled order.
 *
 * Once the user finishes all 5, the widget resolves this tool call via
 * addToolOutput with their answers, and the model continues (per the
 * RISK PROFILE QUIZ guidance in lib/ai/tools.ts) by calling
 * scoreRiskProfile with exactly those letters.
 */
export function createPresentRiskQuiz() {
  return tool({
    description:
      "Open the interactive risk-profile quiz widget so the user can click their answers instead of typing them. " +
      "Call this with no arguments whenever the risk-profile flow needs to start — do NOT type out the 5 questions " +
      "yourself first; the widget owns their exact wording, options, and (randomized) presentation order. " +
      "This call pauses until the user finishes all 5 questions in the widget, then returns their answers as " +
      "single letters (A/B/C/D) keyed q1..q5, matching the fixed question order in <risk_profile> " +
      "(NOT the shuffled order the user saw on screen). Once you have this result, call scoreRiskProfile with " +
      "exactly these letters — never score them yourself.",
    inputSchema: z.object({}),
    // No execute: resolved client-side.
  });
}

export type PresentRiskQuizOutput = {
  q1: "A" | "B" | "C" | "D";
  q2: "A" | "B" | "C" | "D";
  q3: "A" | "B" | "C" | "D";
  q4: "A" | "B" | "C" | "D";
  q5: "A" | "B" | "C" | "D";
};
