"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GOAL_LABELS, learnerPreferencesSchema, learnerProfileMarkdown, type LearnerProfile } from "@/lib/learner-profile";

const QUESTIONS = [
  { key: "familiarity", title: "How familiar are you with investing?", options: [["new", "I’m starting from scratch"], ["some-basics", "I know a few basics"], ["exploring", "I want to explore concepts in more depth"]] },
  { key: "goal", title: "What would you like to understand first?", options: Object.entries(GOAL_LABELS) },
  { key: "language", title: "Which language feels easiest?", options: [["english", "English"], ["hindi", "Hindi"], ["hinglish", "Hinglish"]] },
  { key: "explanation", title: "How do you like things explained?", options: [["short", "A short, simple answer"], ["example", "One clear example"], ["steps", "A few steps, one at a time"]] },
] as const;

export function LearnerOnboarding({ open, initial, onClose, onComplete, onForget, onSkip }: {
  open: boolean; initial: LearnerProfile | null; onClose: () => void;
  onComplete: (p: LearnerProfile) => void; onForget: () => void; onSkip: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initial ? { ...initial.preferences } : {});
  const [remember, setRemember] = useState(initial?.rememberOnDevice ?? false);
  const q = QUESTIONS[step];
  function complete() {
    const preferences = learnerPreferencesSchema.parse(answers);
    onComplete({ version: 1, preferences, exploredTopics: initial?.exploredTopics ?? [], updatedAt: new Date().toISOString(), rememberOnDevice: remember });
  }
  function download() {
    if (!initial) return;
    const url = URL.createObjectURL(new Blob([learnerProfileMarkdown(initial)], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "finbuddy-learning-profile.md"; link.click(); URL.revokeObjectURL(url);
  }
  return <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Let’s make learning fit you</DialogTitle>
        <DialogDescription>Four quick choices. No search, financial details, or risk score.</DialogDescription>
      </DialogHeader>
      <p className="text-xs font-medium text-brand-blue">Question {step + 1} of 4</p>
      <fieldset className="space-y-2">
        <legend className="mb-3 text-base font-semibold">{q.title}</legend>
        {q.options.map(([value, label]) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${answers[q.key] === value ? "border-brand-blue bg-brand-tint" : "border-border"}`}>
          <input type="radio" name={q.key} value={value} checked={answers[q.key] === value} onChange={() => setAnswers(a => ({ ...a, [q.key]: value }))} />{label}
        </label>)}
      </fieldset>
      {step === 3 && <div className="space-y-2 text-xs text-muted-foreground">
        <p>These choices shape explanations in this chat and are sent with your questions to the selected AI provider. They are not used to recommend investments or for marketing.</p>
        <label className="flex items-start gap-2"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />Remember for this chat on this device for 30 days. Otherwise, use only while this page stays open.</label>
      </div>}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={step ? () => setStep(s => s - 1) : onSkip}>{step ? "Back" : "Skip"}</Button>
        <Button disabled={!answers[q.key]} onClick={step === 3 ? complete : () => setStep(s => s + 1)}>{step === 3 ? "Use these preferences" : "Next"}</Button>
      </div>
      {initial && <div className="flex justify-between border-t pt-3 text-xs">
        <Button variant="ghost" size="sm" onClick={download}>Export profile .md</Button>
        <Button variant="ghost" size="sm" onClick={onForget}>Delete preferences</Button>
      </div>}
    </DialogContent>
  </Dialog>;
}
