"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  shuffledQuizQuestions,
  type RiskQuizAnswerLetter,
  type RiskQuizQuestionKey,
} from "@/lib/risk-quiz-questions";
import type { PresentRiskQuizOutput } from "@/app/api/chat/tools/present-risk-quiz";

type QuizPartLike = {
  toolCallId: string;
  state?: string;
};

export type AddRiskQuizOutput = (args: {
  tool: "presentRiskQuiz";
  toolCallId: string;
  output: PresentRiskQuizOutput;
}) => void;

/**
 * Interactive click-to-answer risk-profile quiz. Renders in place of the
 * generic ToolCall spinner whenever a `tool-presentRiskQuiz` part is
 * awaiting resolution (see components/messages/assistant-message.tsx).
 *
 * The 5 fixed questions come from lib/risk-quiz-questions.ts (the single
 * source of truth also used by prompts.ts and score-risk-profile.ts) and
 * are shown one at a time, in a freshly shuffled order, as clickable
 * option buttons instead of free text. Once all 5 are answered, the
 * answers are handed back to the model via addToolOutput, keyed by their
 * original q1..q5 position (not the shuffled on-screen order).
 */
export function RiskQuizWidget({
  part,
  addToolOutput,
}: {
  part: QuizPartLike;
  addToolOutput?: AddRiskQuizOutput;
}) {
  const [order] = useState(() => shuffledQuizQuestions());
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<RiskQuizQuestionKey, RiskQuizAnswerLetter>>>({});
  const [selected, setSelected] = useState<RiskQuizAnswerLetter | null>(null);
  const [done, setDone] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const total = order.length;
  const current = order[idx];

  const progressLabel = useMemo(() => `Question ${idx + 1} of ${total}`, [idx, total]);

  function handleSelect(letter: RiskQuizAnswerLetter) {
    if (selected) return; // already advancing
    setSelected(letter);
    const nextAnswers = { ...answers, [current.key]: letter };
    setAnswers(nextAnswers);

    window.setTimeout(() => {
      if (idx < total - 1) {
        setIdx((i) => i + 1);
        setSelected(null);
      } else {
        setDone(true);
        window.setTimeout(() => {
          addToolOutput?.({
            tool: "presentRiskQuiz",
            toolCallId: part.toolCallId,
            output: nextAnswers as PresentRiskQuizOutput,
          });
        }, 650);
      }
    }, 320);
  }

  function handleBack() {
    if (idx === 0) return;
    const prevKey = order[idx - 1].key;
    setAnswers((a) => {
      const next = { ...a };
      delete next[prevKey];
      return next;
    });
    setIdx((i) => i - 1);
    setSelected(null);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-5 py-8">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0.2 : 0.4, ease: "easeOut" }}
        >
          <CheckCircle2 className="size-9 text-quiz-teal" strokeWidth={1.75} />
        </motion.div>
        <p className="text-sm font-medium text-foreground">All done — figuring out your profile…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground">
          {progressLabel}
        </span>
        <div className="flex gap-1.5">
          {order.map((q, i) => (
            <div
              key={q.key}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i < idx ? "w-5 bg-quiz-teal" : i === idx ? "w-7 bg-quiz-gold" : "w-5 bg-border"
              )}
            />
          ))}
        </div>
      </div>

      <p className="text-[15px] font-semibold leading-snug text-foreground">{current.text}</p>

      <div className="flex flex-col gap-2">
        {current.options.map((opt) => {
          const isSelected = selected === opt.letter;
          return (
            <button
              key={opt.letter}
              type="button"
              disabled={selected !== null}
              onClick={() => handleSelect(opt.letter)}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm leading-snug transition-colors",
                "border-border bg-background hover:border-quiz-teal disabled:cursor-default",
                isSelected && "border-quiz-teal bg-quiz-teal-soft"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold",
                  isSelected
                    ? "bg-quiz-teal text-white"
                    : "bg-quiz-teal-soft text-quiz-teal"
                )}
              >
                {opt.letter}
              </span>
              <span>{opt.text}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleBack}
        disabled={idx === 0}
        className="self-start text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      >
        ← Back
      </button>
    </div>
  );
}
