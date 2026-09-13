"use client";

import { useState } from "react";
import { BookOpen, Globe, ExternalLink, Check, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { UISource } from "@/types/data";

function hostLabel(s: UISource): string {
  const parts: string[] = [];
  if (s.site) parts.push(s.site);
  if (s.publishedDate) parts.push(s.publishedDate);
  return parts.join(" · ");
}

// Only http(s) URLs may render as links. Source URLs come from crawled web
// results and KB metadata; anything else (javascript:, data:, etc.) is shown
// as plain text.
function isSafeHref(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Code-rendered Sources box — the single reference list under an answer.
 * Populated from the `data-sources` stream part. Each entry carries the exact
 * citation number parsed from the model's inline [[N]](url) citations, so the
 * numbers shown here are by construction the same ones used in the text.
 *
 * Collapsed by default behind a small pill (title + count + chevron), the
 * same pattern Gemini uses for its sources/thinking chips — the list itself
 * is detail the reader opts into, not something that always eats vertical
 * space under every answer.
 */
export function Sources({ sources }: { sources: UISource[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <BookOpen className="size-3.5" />
        Sources ({sources.length})
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform",
            isOpen ? "rotate-180" : "rotate-0"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 data-[state=closed]:animate-out data-[state=open]:animate-in">
        <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
            {sources.map((s, i) => {
              const icon =
                s.kind === "web" ? (
                  <Globe className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <BookOpen className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                );
              const sub = hostLabel(s);

              return (
                <li key={`${s.url || s.title}-${i}`} className="flex items-start gap-2 text-sm">
                  <span className="mt-px w-5 shrink-0 text-right text-xs font-medium text-muted-foreground">
                    {s.number ?? i + 1}.
                  </span>
                  {icon}
                  <div className="min-w-0 flex-1">
                    {/* Single-line title row: title truncates, icons stay on the
                        line — the verification check can never wrap to a new line. */}
                    <div className="flex min-w-0 items-center gap-1">
                      {s.url && isSafeHref(s.url) ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 items-center gap-1 text-foreground hover:underline"
                        >
                          <span className="truncate">{s.title}</span>
                          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                        </a>
                      ) : (
                        <span className="min-w-0 truncate text-foreground">{s.title}</span>
                      )}
                      {s.verified === true && (
                        <Check
                          className="size-3.5 shrink-0 text-green-600 dark:text-green-500"
                          aria-label="Citation verified against the source"
                        />
                      )}
                    </div>
                    {sub && (
                      <div className="truncate text-xs text-muted-foreground">{sub}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
