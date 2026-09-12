"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { FundRecommendationsOutput } from "@/app/api/chat/tools/fund-recommendations";
import type { FundOption, Holding, RiskTierProfile } from "@/lib/fund-recommendations-data";

const TIER_TOKEN: Record<RiskTierProfile, string> = {
  Conservative: "conservative",
  Moderate: "moderate",
  "Growth-oriented": "growth",
  Aggressive: "aggressive",
};

// How many holdings a fund row shows before the user has to expand it. Real
// disclosed-holdings lists now run to ~60% of the portfolio (15-40 lines),
// so showing all of them by default would make the comparison view
// unusably long — collapsed-by-default keeps the initial "compare 5 funds"
// view scannable, while "show all" gives the full picture for the
// follow-up "tell me more about this one" conversation.
const COLLAPSED_HOLDING_COUNT = 6;

function formatWeight(weightPct: number): string {
  return Number.isInteger(weightPct) ? `${weightPct}%` : `${weightPct.toFixed(2).replace(/0$/, "").replace(/\.$/, "")}%`;
}

const CATEGORY_STYLE: Record<Holding["category"], string> = {
  equity: "border-border bg-muted/40 text-muted-foreground",
  reit_invit: "border-border bg-muted/40 text-muted-foreground",
  debt: "border-border/60 bg-muted/15 text-muted-foreground/80",
  other: "border-border/60 bg-muted/15 text-muted-foreground/70",
};

function HoldingChip({ holding }: { holding: Holding }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-snug",
        CATEGORY_STYLE[holding.category]
      )}
    >
      <span>{holding.name}</span>
      <span className="font-mono">{formatWeight(holding.weightPct)}</span>
    </span>
  );
}

function FundRow({ fund, token }: { fund: FundOption; token: string }) {
  const hasAllocation = fund.equityPct !== undefined;
  const [showAll, setShowAll] = useState(false);

  const visibleHoldings = showAll ? fund.topHoldings : fund.topHoldings.slice(0, COLLAPSED_HOLDING_COUNT);
  const hiddenCount = fund.topHoldings.length - visibleHoldings.length;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background px-3.5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[13px] font-semibold leading-snug text-foreground">{fund.schemeName}</span>
        <span className="text-[11px] text-muted-foreground">{fund.amc}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {hasAllocation && (
          <div className="flex items-center gap-1.5">
            <div className="flex h-2 w-14 overflow-hidden rounded-full border border-border">
              <div
                style={{ width: `${fund.equityPct}%`, backgroundColor: `var(--band-${token})` }}
              />
              <div className="flex-1 bg-muted" />
            </div>
            <span className="font-mono text-muted-foreground">
              {fund.equityPct}% eq{fund.debtPct !== undefined ? ` / ${fund.debtPct}% debt` : ""}
            </span>
          </div>
        )}
        <span className="text-muted-foreground">
          3Y{" "}
          <span className="font-mono font-semibold text-foreground">
            {fund.returns3Y !== undefined ? `${fund.returns3Y}%` : "—"}
          </span>
          {" · "}5Y{" "}
          <span className="font-mono font-semibold text-foreground">
            {fund.returns5Y !== undefined
              ? `${fund.returns5Y}%`
              : fund.returnsSinceInception !== undefined
                ? `${fund.returnsSinceInception}% since inception`
                : "—"}
          </span>
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `var(--band-${token}-soft)`, color: `var(--band-${token})` }}
        >
          {fund.riskometer}
        </span>
        {fund.expenseRatioDirect !== undefined && (
          <span className="text-muted-foreground">
            ER <span className="font-mono text-foreground">{fund.expenseRatioDirect}%</span>
          </span>
        )}
      </div>

      {fund.allocationNote && (
        <p className="text-[11px] leading-snug text-muted-foreground">{fund.allocationNote}</p>
      )}

      {fund.topHoldings.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <span className="text-[11px] font-medium text-foreground/80">Top holdings</span>
            <span className="text-[10px] text-muted-foreground/75">{fund.holdingsCoverageNote}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visibleHoldings.map((holding) => (
              <HoldingChip key={`${holding.name}-${holding.weightPct}`} holding={holding} />
            ))}
          </div>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-0.5 self-start text-[10px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Show {hiddenCount} more holding{hiddenCount === 1 ? "" : "s"}
            </button>
          )}
          {showAll && fund.topHoldings.length > COLLAPSED_HOLDING_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="mt-0.5 self-start text-[10px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Show fewer
            </button>
          )}
        </div>
      )}

      {fund.note && <p className="text-[11px] italic leading-snug text-muted-foreground">{fund.note}</p>}

      <p className="text-[10px] text-muted-foreground/75">
        Source: {fund.sourceLabel}, as of {fund.asOf} —{" "}
        <a href={fund.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          view
        </a>
      </p>
    </div>
  );
}

export function FundRecommendationsCard({ output }: { output: FundRecommendationsOutput }) {
  const token = TIER_TOKEN[output.profile];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold")}
          style={{ backgroundColor: `var(--band-${token}-soft)`, color: `var(--band-${token})` }}
        >
          {output.profile} — real fund options
        </span>
        <span className="text-[11px] text-muted-foreground">{output.funds.length} funds compared</span>
      </div>

      {output.tierNote && (
        <p className="text-xs leading-relaxed text-muted-foreground">{output.tierNote}</p>
      )}

      {output.riskDisclosure && (
        <div
          className="flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-xs leading-relaxed"
          style={{ borderColor: `var(--band-${token})`, backgroundColor: `var(--band-${token}-soft)` }}
        >
          <span className="font-semibold text-foreground">Risk &amp; downside</span>
          <span className="text-muted-foreground">{output.riskDisclosure}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {output.funds.map((fund) => (
          <FundRow key={`${fund.amc}-${fund.schemeName}`} fund={fund} token={token} />
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground/75">
        Figures are point-in-time snapshots and drift over time — check each fund&rsquo;s current factsheet before
        acting. Shown for educational comparison, not a recommendation to buy any specific scheme.
      </p>
    </div>
  );
}
