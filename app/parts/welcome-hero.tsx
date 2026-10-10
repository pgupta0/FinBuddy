"use client";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { STARTER_PROMPTS } from "@/lib/starter-prompts";

export function WelcomeHero({ onSelect, disabled = false }: {
  onSelect: (prompt: string) => void; disabled?: boolean;
}) {
  return (
    <section aria-labelledby="welcome-title" className="welcome-panel mx-auto w-full max-w-3xl">
      <div className="welcome-heading flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-red" aria-hidden="true" />
            Your investing journey starts here
          </p>
          <h1 id="welcome-title" className="text-3xl font-semibold leading-tight tracking-tight text-brand-navy sm:text-4xl">
            Make sense of <span className="text-brand-blue">investing.</span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Simple explanations. Clear sources. At your pace.</p>
        </div>
        <Image src="/finbuddy-mascot.png" alt="" aria-hidden="true" width={473} height={455} priority
          className="welcome-mascot hidden h-auto w-28 shrink-0 select-none sm:block" />
      </div>
      <div className="welcome-options mt-6">
        <h2 className="mb-3 text-sm font-medium text-brand-navy">What would you like to understand?</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          {STARTER_PROMPTS.map(({ id, label, hint, prompt, icon: Icon }, index) => (
            <button key={id} type="button" aria-label={`${label}. ${hint}${index === 0 ? ". Start here." : ""}`} disabled={disabled} onClick={() => onSelect(prompt)}
              className={`welcome-card group relative flex min-h-28 flex-col items-start rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:p-4 ${index === 0 ? "border-brand-blue/40 bg-brand-tint hover:border-brand-blue" : "border-border bg-card/90 hover:border-brand-blue/50 hover:bg-brand-tint/50"}`}>
              <span className="mb-2 flex w-full items-center justify-between">
                <Icon aria-hidden="true" className={`size-5 ${index === 0 ? "text-brand-blue" : "text-brand-red"}`} strokeWidth={1.8} />
                {index === 0 ? <span className="rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-semibold text-white">Start here</span>
                  : <ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground/50 group-hover:text-brand-blue" />}
              </span>
              <span className="text-sm font-semibold leading-snug text-brand-navy">{label}</span>
              <span className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">Financial education, not investment advice. Not a SEBI-registered adviser.</p>
    </section>
  );
}
