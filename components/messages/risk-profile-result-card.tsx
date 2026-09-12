"use client";

import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { RiskProfileToolOutput } from "@/app/api/chat/tools/score-risk-profile";

// Score-band boundaries for drawing the 4-color gauge arc. These are purely
// cosmetic (for the gauge's band widths) and mirror the BANDS table in
// app/api/chat/tools/score-risk-profile.ts — if that table's score cutoffs
// ever change, update these boundaries to match.
const GAUGE_BOUNDARIES = [4.5, 10.5, 12.5, 14.5, 20.5];
const GAUGE_BAND_KEYS = ["conservative", "moderate", "growth", "aggressive"] as const;

const TIER_TOKEN: Record<RiskProfileToolOutput["profile"], (typeof GAUGE_BAND_KEYS)[number]> = {
  Conservative: "conservative",
  Moderate: "moderate",
  "Growth-oriented": "growth",
  Aggressive: "aggressive",
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function RiskGauge({ score }: { score: number }) {
  const gradId = useId();
  const cx = 110;
  const cy = 100;
  const r = 82;
  const r2 = 64;
  const [lo, hi] = [GAUGE_BOUNDARIES[0], GAUGE_BOUNDARIES[GAUGE_BOUNDARIES.length - 1]];

  const bands = useMemo(() => {
    const arr: { d: string; token: (typeof GAUGE_BAND_KEYS)[number] }[] = [];
    for (let i = 0; i < GAUGE_BAND_KEYS.length; i++) {
      const a0 = ((GAUGE_BOUNDARIES[i] - lo) / (hi - lo)) * 180;
      const a1 = ((GAUGE_BOUNDARIES[i + 1] - lo) / (hi - lo)) * 180;
      arr.push({ d: describeArc(cx, cy, r, a0, a1), token: GAUGE_BAND_KEYS[i] });
    }
    return arr;
  }, [hi, lo]);

  const clamped = Math.max(lo, Math.min(hi, score));
  const needleAngle = ((clamped - lo) / (hi - lo)) * 180;
  const tip = polarToCartesian(cx, cy, r2, needleAngle);

  return (
    <svg viewBox="0 0 220 118" width="220" height="118" role="img" aria-label={`Risk gauge showing a score of ${score} out of 20`}>
      <defs>
        <clipPath id={`${gradId}-clip`}>
          <rect x="0" y="0" width="220" height="118" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${gradId}-clip)`}>
        {bands.map((b) => (
          <path
            key={b.token}
            d={b.d}
            style={{ stroke: `var(--band-${b.token})` }}
            strokeWidth={14}
            fill="none"
          />
        ))}
      </g>
      <line
        x1={cx}
        y1={cy}
        x2={tip.x}
        y2={tip.y}
        stroke="currentColor"
        className="text-foreground"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={6} className="fill-foreground" />
    </svg>
  );
}

export function RiskProfileResultCard({ output }: { output: RiskProfileToolOutput }) {
  const token = TIER_TOKEN[output.profile];
  const equityMax = output.equityMax;
  const debtMax = 100 - output.equityMin;
  const debtMin = 100 - output.equityMax;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          )}
          style={{ backgroundColor: `var(--band-${token}-soft)`, color: `var(--band-${token})` }}
        >
          {output.profile} profile
        </span>
        <span className="text-xs text-muted-foreground">
          Total score <span className="font-mono font-semibold text-foreground">{output.score} / {output.maxScore}</span>
        </span>
      </div>

      <div className="flex justify-center">
        <RiskGauge score={output.score} />
      </div>
      <p className="-mt-2 text-center text-[11px] text-muted-foreground">
        Styled after SEBI&rsquo;s mandatory mutual-fund Riskometer
      </p>

      <div>
        <div className="flex h-3.5 overflow-hidden rounded-full border border-border">
          <div style={{ width: `${equityMax}%`, backgroundColor: `var(--band-${token})` }} />
          <div className="flex-1 bg-muted" />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span>
            Equity <span className="font-mono font-semibold text-foreground">{output.equityMin}–{output.equityMax}%</span>
          </span>
          <span>
            Debt <span className="font-mono font-semibold text-foreground">{debtMin}–{debtMax}%</span>
          </span>
        </div>
      </div>

      {output.capped && (
        <div
          className="flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-xs leading-relaxed"
          style={{
            borderColor: `var(--band-${token})`,
            backgroundColor: `var(--band-${token}-soft)`,
          }}
        >
          <span className="font-semibold text-foreground">
            Your score alone would place you in {output.scoreBandProfile} — capped to {output.profile}
          </span>
          {output.capReasons.map((reason) => (
            <span key={reason} className="text-muted-foreground">
              {reason}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Matched real-world category: <span className="font-medium text-foreground">{output.fundCategory}</span>
      </p>
    </div>
  );
}
