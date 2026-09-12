# Real-World Allocation Benchmarks, by Risk Profile

This document maps FinBuddy's four risk-profile tiers (Conservative, Moderate, Growth-oriented,
Aggressive — see the risk-profile quiz) to actual, published allocation strategies from real
mutual funds and one independent analyst classification framework. These are illustrative
real-world comparisons, not a guarantee that any specific fund will perform a certain way, and
exact holdings shift over time — always check a scheme's current factsheet before relying on a
precise number.

## Conservative tier — real example: Motilal Oswal Asset Allocation Passive Fund of Fund (Conservative)

This is a real, currently available Indian mutual fund whose own stated strategy is explicitly
labeled "Conservative." Its benchmark target allocation is:

- **25%** Indian equity (tracking the Nifty 500)
- **10%** US equity (tracking the S&P 500)
- **60%** Indian government securities (Nifty 5-Year G-Sec)
- **5%** Gold

That is roughly **35% total equity, 60% debt, 5% gold** — a real fund house's own answer to "what
does a conservative multi-asset portfolio look like," combining domestic equity, a small
international sleeve, high-quality government debt, and a gold hedge. Note this is a multi-asset
Fund of Funds, not a SEBI "Conservative Hybrid Fund" — its total equity (~35%) sits a bit above the
SEBI Conservative Hybrid Fund ceiling (25%, see the mutual fund categories document), since it's a
different fund type with its own mandate. Source: [freefincal — Motilal Oswal Asset Allocation
Passive FoFs Review](https://freefincal.com/motilal-oswal-asset-allocation-passive-fofs-review/),
citing the fund's own benchmark disclosure. The fund itself retains flexibility to deviate from
this benchmark, so actual current holdings can differ — check the fund's latest factsheet.

## Moderate tier — real fund type: Balanced Advantage / Dynamic Asset Allocation Funds

For the Moderate tier, the clearest real-world comparison is the **Balanced Advantage Fund /
Dynamic Asset Allocation Fund** category (see the mutual fund categories document) — schemes like
ICICI Prudential Balanced Advantage Fund, whose defining real feature is that they *dynamically*
move their equity allocation up and down (often across the full Balanced Hybrid to Aggressive
Hybrid range, roughly 40–80% equity) based on market valuation signals, rather than holding one
fixed percentage. This dynamic behavior is itself the real-world strategy worth understanding for
this tier: the fund manager, not the investor, is doing the tactical shifting, aiming to hold more
equity when valuations look reasonable and less when markets look expensive. Source:
[Business Standard — Balanced advantage fund equity exposure off lows as valuations
improve](https://www.business-standard.com/amp/markets/news/balanced-advantage-fund-equity-exposure-off-lows-as-valuations-improve-125032501051_1.html).
For a fixed-allocation comparison at this tier, SEBI's Balanced Hybrid Fund category (40–60%
equity, 40–60% debt) remains the direct regulatory benchmark.

## Growth-oriented tier — real example: Motilal Oswal Asset Allocation Passive Fund of Fund (Aggressive)

The same fund house's "Aggressive" variant of the fund above gives a real, disclosed benchmark for
this tier:

- **60%** Indian equity (Nifty 500)
- **20%** US equity (S&P 500)
- **15%** Indian government securities (Nifty 5-Year G-Sec)
- **5%** Gold

That is **80% total equity, 15% debt, 5% gold** — landing right at the top of SEBI's Aggressive
Hybrid Fund equity ceiling (65–80%, see the mutual fund categories document), which makes it a
genuinely close real-world match for this tier. Source: same freefincal review as above, citing the
fund's benchmark disclosure.

## Aggressive tier — real example: Parag Parikh Flexi Cap Fund

For the top tier (predominantly equity, SEBI Equity Scheme category), Parag Parikh Flexi Cap Fund
is a well-known real example with a distinctive, disclosed approach: a **value-investing
philosophy** that looks for "businesses going through a painful phase" the market has temporarily
soured on, betting on recovery. Its real, disclosed structure:

- Roughly **65% in listed Indian equities** (structured this way partly for favorable domestic
  capital-gains tax treatment)
- The remainder split between **foreign equities and a debt/fixed-income sleeve**
- Genuinely flexible across large-cap, mid-cap, and small-cap — "no self-imposed limitations in
  terms of sector, market capitalisation, geography"

Source: [PPFAS Mutual Fund — Parag Parikh Flexi Cap
Fund](https://amc.ppfas.com/schemes/parag-parikh-flexi-cap-fund/). This illustrates that even a
predominantly-equity, high-conviction fund at this tier typically still carries a modest
international and debt sleeve for diversification, rather than being 100% domestic equity.

## An independent analyst framework: Morningstar's Allocation Categories

Separate from any single fund house, Morningstar — a widely used independent fund-research and
categorization firm — defines its own "Allocation" fund categories by equity range, used globally
to classify multi-asset funds regardless of which AMC manages them:

- **Conservative Allocation**: typically **20–50% equity**, 50–80% fixed income and cash.

Source: [Morningstar — Conservative Allocation Category
definition](https://awgmain.morningstar.com/webhelp/glossary_definitions/categories/Conservative_Allocation_Category.htm).
This is a useful independent cross-check: it confirms the ~35% equity real example above for the
Conservative tier falls squarely inside a globally recognized "conservative" range, not just one
fund house's own labeling.

## How to use this with a user's risk-profile result

Once the risk-profile quiz (see `scoreRiskProfile`) returns a tier, use the matching section above
to give a concrete, real-world-grounded picture of what a portfolio at that risk level actually
looks like in practice — citing the specific fund or framework by name — rather than a generic,
invented percentage split.
