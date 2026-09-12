"use client";

import Image from "next/image";
import { STARTER_PROMPTS } from "@/lib/starter-prompts";

/**
 * Empty-state landing screen. Rendered by app/page.tsx in place of the
 * MessageWall while a conversation has no user turns yet. Clicking a card
 * calls onSelect with that card's prompt, which app/page.tsx sends exactly as
 * if the user had typed it — so the hero unmounts on the first message and
 * never reappears for that conversation.
 */
export function WelcomeHero({
  onSelect,
  disabled = false,
}: {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* --- Hero: copy on the left, mascot on the right --- */}
      <div className="grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-6 h-1 w-12 rounded-full bg-brand-blue" />

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] text-brand-navy">
            Your Finance
            <br />
            <span className="text-brand-blue">Copilot</span>
          </h1>

          <p className="mt-5 text-xl font-semibold text-muted-foreground">
            Ask. Analyze. Act.
          </p>

          <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
            Get instant insights, simplified explanations and data-driven
            answers for all your finance questions.
          </p>
        </div>

        {/* Mascot + speech bubble. Hidden on the narrowest screens so the
            starter cards stay above the fold on a phone. */}
        <div className="relative hidden sm:block">
          <div className="relative mx-auto w-fit">
            <div className="absolute -top-2 left-0 z-10 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2.5 text-sm font-medium text-brand-navy shadow-sm">
              How can I help you today?
            </div>
            <Image
              src="/finbuddy-mascot.png"
              alt=""
              aria-hidden="true"
              width={473}
              height={455}
              priority
              className="h-auto w-56 md:w-64 select-none"
            />
          </div>
        </div>
      </div>

      {/* --- Starter prompts --- */}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-brand-navy">
          Try asking&hellip;
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STARTER_PROMPTS.map(({ id, label, hint, prompt, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(prompt)}
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-brand-blue hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-blue transition-colors group-hover:bg-brand-blue group-hover:text-white">
                <Icon className="size-4.5" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug text-brand-navy">
                  {label}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Financial knowledge. Simplified.
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
