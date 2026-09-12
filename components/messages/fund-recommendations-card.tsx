"use client";

import { useEffect, useState } from "react";
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

function formatPrice(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * Best-effort live LAST-TRADED PRICE for holdings with a real NSE ticker
 * (see lib/fund-recommendations-data.ts). Fetches once for every ticker
 * shown in this card in a single batched request; if the feature is off,
 * credentials aren't set up, or the request fails, `prices` just stays
 * empty and every holding renders exactly as it did before this feature
 * existed — no error shown to the user.
 */
function useHoldingPrices(funds: FundOption[]): Record<string, number> {
  const [prices, setPrices] = useState<Record<string, number>>({});

  const symbols = Array.from(
    new Set(
      funds.flatMap((f) => f.topHoldings.map((h) => h.ticker?.tradingSymbol).filter((s): s is string => Boolean(s)))
    )
  ).sort();
  const symbolsKey = symbols.join(",");

  useEffect(() => {
    if (!symbolsKey) return;
    let cancelled = false;
    fetch(`/api/holdings-price?symbols=${encodeURIComponent(symbolsKey)}`)
      .then((res) => res.json())
      .then((data: { available?: boolean; prices?: Record<string, number> }) => {
        if (!cancelled && data.available && data.prices) setPrices(data.prices);
      })
      .catch(() => {
        // Live prices are a decoration only — silently keep showing holdings
        // without a price rather than surfacing a fetch error.
      });
    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  return prices;
}

interface QuoteInfo {
  lastPrice?: number;
  dayChange?: number;
  dayChangePct?: number;
  open?: number;
  high?: number;
  low?: number;
  prevClose?: number;
  volume?: number;
  week52High?: number;
  week52Low?: number;
}

/**
 * Lazy, per-symbol "basic stock info" fetch (day change, OHLC, 52-week
 * range) via Groww's single-symbol quote endpoint — see
 * app/api/holdings-quote/route.ts for why this can't be batched the way the
 * LTP feed above is. Only fires when the user actually expands a holding,
 * and caches per symbol for the life of the card so re-expanding is instant.
 */
function useStockQuote(symbol: string | null) {
  const [quotes, setQuotes] = useState<Record<string, QuoteInfo | null>>({});

  useEffect(() => {
    if (!symbol || symbol in quotes) return;
    let cancelled = false;
    fetch(`/api/holdings-quote?symbol=${encodeURIComponent(symbol)}`)
      .then((res) => res.json())
      .then((data: { available?: boolean; quote?: QuoteInfo }) => {
        if (cancelled) return;
        setQuotes((prev) => ({ ...prev, [symbol]: data.available && data.quote ? data.quote : null }));
      })
      .catch(() => {
        if (!cancelled) setQuotes((prev) => ({ ...prev, [symbol]: null }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // Derived rather than a separate effect-set state: still loading whenever
  // a symbol is expanded but its entry hasn't landed in `quotes` yet.
  const loading = symbol !== null && !(symbol in quotes);

  return { quotes, loading };
}

const CATEGORY_STYLE: Record<Holding["category"], string> = {
  equity: "border-border bg-muted/40 text-muted-foreground",
  reit_invit: "border-border bg-muted/40 text-muted-foreground",
  debt: "border-border/60 bg-muted/15 text-muted-foreground/80",
  other: "border-border/60 bg-muted/15 text-muted-foreground/70",
};

function HoldingChip({
  holding,
  livePrice,
  expanded,
  onToggle,
  quote,
  quoteLoading,
}: {
  holding: Holding;
  livePrice?: number;
  expanded: boolean;
  onToggle: () => void;
  quote?: QuoteInfo | null;
  quoteLoading: boolean;
}) {
  const clickable = Boolean(holding.ticker);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!clickable}
        onClick={clickable ? onToggle : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-snug transition-colors",
          CATEGORY_STYLE[holding.category],
          clickable && "cursor-pointer hover:border-foreground/30",
          !clickable && "cursor-default"
        )}
        title={clickable ? "Tap for basic stock info (Groww live data)" : undefined}
      >
        <span>{holding.name}</span>
        <span className="font-mono">{formatWeight(holding.weightPct)}</span>
        {livePrice !== undefined && (
          <span className="font-mono font-medium text-foreground">{formatPrice(livePrice)}</span>
        )}
      </button>

      {expanded && clickable && (
        <div className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
          {quoteLoading && "Loading live info…"}
          {!quoteLoading && quote === null && "Live info unavailable right now."}
          {!quoteLoading && quote && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
              {quote.lastPrice !== undefined && (
                <span>
                  LTP <span className="text-foreground">{formatPrice(quote.lastPrice)}</span>
                </span>
              )}
              {quote.dayChangePct !== undefined && (
                <span className={quote.dayChangePct >= 0 ? "text-[var(--band-growth)]" : "text-destructive"}>
                  Day {quote.dayChangePct >= 0 ? "+" : ""}
                  {quote.dayChangePct.toFixed(2)}%
                </span>
              )}
              {quote.open !== undefined && (
                <span>
                  Open <span className="text-foreground">{formatPrice(quote.open)}</span>
                </span>
              )}
              {quote.prevClose !== undefined && (
                <span>
                  Prev close <span className="text-foreground">{formatPrice(quote.prevClose)}</span>
                </span>
              )}
              {quote.high !== undefined && quote.low !== undefined && (
                <span>
                  Day range{" "}
                  <span className="text-foreground">
                    {formatPrice(quote.low)}–{formatPrice(quote.high)}
                  </span>
                </span>
              )}
              {quote.week52High !== undefined && quote.week52Low !== undefined && (
                <span>
                  52W range{" "}
                  <span className="text-foreground">
                    {formatPrice(quote.week52Low)}–{formatPrice(quote.week52High)}
                  </span>
                </span>
              )}
            </div>
          )}
          <p className="mt-1 text-[9px] italic text-muted-foreground/70">
            Live market data, reference only — not a recommendation to trade this stock directly.
          </p>
        </div>
      )}
    </div>
  );
}

function FundRow({
  fund,
  token,
  livePrices,
}: {
  fund: FundOption;
  token: string;
  livePrices: Record<string, number>;
}) {
  const hasAllocation = fund.equityPct !== undefined;
  const [showAll, setShowAll] = useState(false);
  const [expandedHolding, setExpandedHolding] = useState<string | null>(null);
  const { quotes, loading } = useStockQuote(expandedHolding);

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
            {visibleHoldings.map((holding) => {
              const symbol = holding.ticker?.tradingSymbol;
              const key = `${holding.name}-${holding.weightPct}`;
              return (
                <HoldingChip
                  key={key}
                  holding={holding}
                  livePrice={symbol ? livePrices[symbol] : undefined}
                  expanded={Boolean(symbol) && expandedHolding === symbol}
                  onToggle={() => symbol && setExpandedHolding((cur) => (cur === symbol ? null : symbol))}
                  quote={symbol ? quotes[symbol] : undefined}
                  quoteLoading={Boolean(symbol) && symbol === expandedHolding && loading}
                />
              );
            })}
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
  const livePrices = useHoldingPrices(output.funds);
  const showingLivePrices = Object.keys(livePrices).length > 0;

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
          <FundRow key={`${fund.amc}-${fund.schemeName}`} fund={fund} token={token} livePrices={livePrices} />
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground/75">
        Figures are point-in-time snapshots and drift over time — check each fund&rsquo;s current factsheet before
        acting. Shown for educational comparison, not a recommendation to buy any specific scheme.
        {showingLivePrices &&
          " Holding prices and any stock info shown are live market data for reference only — not a recommendation to trade those securities directly."}
      </p>
    </div>
  );
}
