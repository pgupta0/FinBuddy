// app/api/chat/tools/fund-recommendations.ts
import { tool } from "ai";
import { z } from "zod";
import { FUND_RECOMMENDATIONS, type RiskTierProfile, type FundOption } from "@/lib/fund-recommendations-data";
import { domainOf } from "@/app/api/chat/tools/web-search";
import type { UISource } from "@/types/data";

/**
 * Deterministic fund-recommendation lookup. Like scoreRiskProfile, this is
 * intentionally NOT left to the model: the specific funds, their AMCs,
 * allocations, returns, and holdings are all fixed in
 * lib/fund-recommendations-data.ts (researched from real, cited sources —
 * AMC factsheets, Value Research, Tickertape, IndMoney). The model's job is
 * only to (a) call this with the user's already-determined risk profile and
 * (b) present exactly what this tool returns, concisely, never inventing or
 * substituting a fund of its own choosing.
 *
 * ONLY call this after scoreRiskProfile has returned a profile (the FINAL
 * one, i.e. after any suitability cap has been applied) — never compute or
 * guess which tier to look up.
 *
 * `collect` feeds each fund's real sourceUrl into the same code-rendered
 * Sources box used by vectorDatabaseSearch/webSearch, so a fund-recommendation
 * response is never missing citations just because the model's prose is kept
 * deliberately brief (see buildToolGuidance's STEP 2 instructions).
 */

const profileSchema = z.enum(["Conservative", "Moderate", "Growth-oriented", "Aggressive"]);

export interface FundRecommendationsOutput {
  profile: RiskTierProfile;
  tierNote?: string;
  /** General category-level risk/downside education — see RiskTierFundSet. */
  riskDisclosure: string;
  funds: FundOption[];
}

export function createFundRecommendations(
  collect: (s: UISource, content?: string) => void = () => {}
) {
  return tool({
    description:
      "Look up the curated list of real, currently-active Indian mutual fund schemes matching a risk profile tier. " +
      "ONLY call this with the profile field scoreRiskProfile actually returned (the final, post-cap profile if a cap applied). " +
      "Returns multiple real funds from different fund houses with similar risk/return but different asset allocation, " +
      "so the user can compare and choose. Do NOT invent, substitute, or omit funds from what this tool returns — " +
      "present them using only the figures in the response, with no rounding or restating different numbers. " +
      "Every fund's sourceUrl is a real citation — cite each fund inline by name using its own [[N]](sourceUrl) the " +
      "same way you would cite a knowledge-base or web source (see <citations>), even though the app's card shows the full figures.",
    inputSchema: z.object({
      profile: profileSchema.describe(
        "The user's risk profile tier exactly as returned by scoreRiskProfile's `profile` field (post-cap if a suitability cap applied)."
      ),
    }),
    execute: async ({ profile }): Promise<FundRecommendationsOutput> => {
      const tier = FUND_RECOMMENDATIONS[profile as RiskTierProfile];

      for (const fund of tier.funds) {
        collect(
          {
            kind: "web",
            title: `${fund.amc} ${fund.schemeName}`.trim(),
            url: fund.sourceUrl,
            site: fund.sourceLabel || domainOf(fund.sourceUrl),
          },
          [
            `${fund.amc} ${fund.schemeName} (${fund.category})`,
            fund.allocationNote,
            fund.holdingsCoverageNote,
          ]
            .filter(Boolean)
            .join("\n")
        );
      }

      return {
        profile: tier.profile,
        tierNote: tier.tierNote,
        riskDisclosure: tier.riskDisclosure,
        funds: tier.funds,
      };
    },
  });
}
