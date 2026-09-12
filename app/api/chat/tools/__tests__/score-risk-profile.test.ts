import { describe, it, expect } from "vitest";
import { createScoreRiskProfile, type RiskProfileToolOutput } from "../score-risk-profile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scoreTool = createScoreRiskProfile() as any;

async function score(q1: string, q2: string, q3: string, q4: string, q5: string): Promise<RiskProfileToolOutput> {
  return scoreTool.execute({ q1, q2, q3, q4, q5 });
}

describe("scoreRiskProfile — scoring and bands", () => {
  it("scores the minimum (all A) as Conservative, total 5", async () => {
    const out = await score("A", "A", "A", "A", "A");
    expect(out.score).toBe(5);
    expect(out.profile).toBe("Conservative");
    expect(out.fundCategory).toBe("Conservative Hybrid Fund");
    expect(out.equityMin).toBe(10);
    expect(out.equityMax).toBe(25);
    expect(out.summary).toContain("Risk profile to present to the user: Conservative");
    expect(out.summary).toContain("10–25% equity, 75–90% debt");
  });

  it("scores the maximum (all D) as Aggressive, total 20", async () => {
    const out = await score("D", "D", "D", "D", "D");
    expect(out.score).toBe(20);
    expect(out.profile).toBe("Aggressive");
    expect(out.fundCategory).toContain("Equity Scheme");
    expect(out.fundCategory).not.toContain("Hybrid Fund");
    expect(out.equityMin).toBe(90);
    expect(out.equityMax).toBe(100);
  });

  it("places the Conservative/Moderate boundary at 10 vs 11", async () => {
    // 10 = B,B,B,B,B -> top of the Conservative band
    const ten = await score("B", "B", "B", "B", "B");
    expect(ten.score).toBe(10);
    expect(ten.profile).toBe("Conservative");

    // 11 = B,B,B,C,B -> first score in the Moderate band
    const eleven = await score("B", "B", "B", "C", "B");
    expect(eleven.score).toBe(11);
    expect(eleven.profile).toBe("Moderate");
    expect(eleven.fundCategory).toBe("Balanced Hybrid Fund");
    expect(eleven.equityMin).toBe(40);
    expect(eleven.equityMax).toBe(60);
  });

  it("places the Moderate/Growth-oriented boundary at 12 vs 13", async () => {
    // 12 = B,B,C,C,B -> top of the Moderate band
    const twelve = await score("B", "B", "C", "C", "B");
    expect(twelve.score).toBe(12);
    expect(twelve.profile).toBe("Moderate");

    // 13 = C,C,C,B,B -> first score in the Growth-oriented band
    const thirteen = await score("C", "C", "C", "B", "B");
    expect(thirteen.score).toBe(13);
    expect(thirteen.profile).toBe("Growth-oriented");
    expect(thirteen.fundCategory).toBe("Aggressive Hybrid Fund");
    expect(thirteen.equityMin).toBe(65);
    expect(thirteen.equityMax).toBe(80);
    expect(thirteen.summary).toContain("65–80% equity, 20–35% debt");
  });

  it("places the Growth-oriented/Aggressive boundary at 14 vs 15", async () => {
    // 14 = C,C,C,C,B -> top of the Growth-oriented band
    const fourteen = await score("C", "C", "C", "C", "B");
    expect(fourteen.score).toBe(14);
    expect(fourteen.profile).toBe("Growth-oriented");

    // 15 = C,C,C,C,C -> first score in the Aggressive band
    const fifteen = await score("C", "C", "C", "C", "C");
    expect(fifteen.score).toBe(15);
    expect(fifteen.profile).toBe("Aggressive");
  });

  it("echoes exact per-question points without rounding or re-deriving", async () => {
    const out = await score("B", "B", "C", "D", "A");
    // B=2, B=2, C=3, D=4, A=1 -> total 12
    expect(out.score).toBe(12);
    expect(out.perQuestion).toEqual([
      { question: "q1", letter: "B", points: 2 },
      { question: "q2", letter: "B", points: 2 },
      { question: "q3", letter: "C", points: 3 },
      { question: "q4", letter: "D", points: 4 },
      { question: "q5", letter: "A", points: 1 },
    ]);
  });

  it("marks the raw score/points/band as internal-only in the summary, never as user-facing", async () => {
    const out = await score("B", "B", "C", "D", "A");
    expect(out.summary).toContain("INTERNAL ONLY");
    expect(out.summary).toContain("never repeat these to the user");
    // The internal marker line carries the raw numbers...
    expect(out.summary).toContain("total 12/20");
    // ...but the line that tells the model what to actually say to the user
    // names only the profile, never a raw score or band range.
    const userFacingLine = out.summary
      .split("\n")
      .find((line: string) => line.startsWith("Risk profile to present"));
    expect(userFacingLine).toBeDefined();
    expect(userFacingLine).not.toMatch(/\d+\s*\/\s*20/);
    expect(userFacingLine).not.toMatch(/\d+–\d+/);
  });

  it("keeps every band reachable across the full 5-20 score range", async () => {
    const letters = ["A", "B", "C", "D"] as const;
    const seen = new Set<string>();
    for (const q1 of letters)
      for (const q2 of letters)
        for (const q3 of letters)
          for (const q4 of letters)
            for (const q5 of letters) {
              const out = await score(q1, q2, q3, q4, q5);
              seen.add(out.profile);
              // Every answer set must resolve to exactly one profile — no gaps.
              expect(out.profile).toBeTruthy();
              expect(out.score).toBeGreaterThanOrEqual(5);
              expect(out.score).toBeLessThanOrEqual(20);
            }
    expect([...seen].sort()).toEqual([
      "Aggressive",
      "Conservative",
      "Growth-oriented",
      "Moderate",
    ]);
  });
});

describe("scoreRiskProfile — suitability caps", () => {
  it("caps a high scorer to Moderate (not Conservative) when they would panic-sell (Q1=A) — behavioural, not capacity", async () => {
    const out = await score("A", "D", "D", "D", "D");
    expect(out.score).toBe(17); // 1+4+4+4+4
    expect(out.scoreBandProfile).toBe("Aggressive");
    expect(out.capped).toBe(true);
    expect(out.profile).toBe("Moderate");
    expect(out.fundCategory).toBe("Balanced Hybrid Fund");
    expect(out.capReasons.join(" ")).toContain("Q1=A");
    expect(out.summary).toContain("CAPPED");
    // The capped explanation must not leak the internal score/band numbers
    // into the part of the summary meant to be relayed to the user.
    const userFacingLine = out.summary
      .split("\n")
      .find((line: string) => line.startsWith("Risk profile to present"))!;
    expect(userFacingLine).not.toMatch(/\d+\s*\/\s*20/);
    expect(userFacingLine).not.toMatch(/\b17\b/);
  });

  it("caps a high scorer all the way to Conservative when they cannot absorb a 10% loss (Q4=A) — capacity, not behavioural", async () => {
    const out = await score("D", "D", "D", "A", "D");
    expect(out.score).toBe(17);
    expect(out.scoreBandProfile).toBe("Aggressive");
    expect(out.capped).toBe(true);
    expect(out.profile).toBe("Conservative");
    expect(out.capReasons.join(" ")).toContain("Q4=A");
  });

  it("takes the stricter floor (Conservative) when both caps apply", async () => {
    const out = await score("A", "D", "D", "A", "D");
    expect(out.capped).toBe(true);
    expect(out.profile).toBe("Conservative");
    expect(out.capReasons).toHaveLength(2);
  });

  it("does not flag a cap when the score is already Conservative", async () => {
    const out = await score("A", "A", "A", "A", "A");
    expect(out.capped).toBe(false);
    expect(out.capReasons).toEqual([]);
    expect(out.profile).toBe("Conservative");
    expect(out.scoreBandProfile).toBe("Conservative");
  });

  it("does not flag a Q1=A cap when the score already sits at or below Moderate", async () => {
    // score = 1(A)+2+2+2+2 = 9 -> Conservative already; Q1's floor (Moderate)
    // isn't stricter than that, so no cap should fire.
    const out = await score("A", "B", "B", "B", "B");
    expect(out.scoreBandProfile).toBe("Conservative");
    expect(out.capped).toBe(false);
    expect(out.profile).toBe("Conservative");
  });

  it("never raises a profile, and never over-restricts Q1=A below its Moderate floor", async () => {
    const letters = ["A", "B", "C", "D"] as const;
    const rank = {
      Conservative: 0,
      Moderate: 1,
      "Growth-oriented": 2,
      Aggressive: 3,
    } as const;
    for (const q1 of letters)
      for (const q4 of letters) {
        const out = await score(q1, "C", "C", q4, "C");
        // Caps only ever move the result down from the score's own band.
        expect(rank[out.profile]).toBeLessThanOrEqual(rank[out.scoreBandProfile]);
        if (q4 === "A") {
          // Capacity constraint — always floors at Conservative.
          expect(out.profile).toBe("Conservative");
        } else if (q1 === "A") {
          // Behavioural constraint — floors at Moderate, never lower.
          expect(rank[out.profile]).toBeLessThanOrEqual(rank["Moderate"]);
          expect(out.profile).not.toBe("Conservative");
        }
      }
  });
});
