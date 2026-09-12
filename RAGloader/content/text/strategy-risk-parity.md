# Strategy Framework: Risk Parity, Explained Simply

## The core idea

Most simple portfolios are built by allocating a percentage of *money* to each asset class — for
example, "60% equity, 40% debt." Risk parity instead starts from a different question: how much of
the portfolio's total *risk* (its ups-and-downs) is coming from each asset class? In a typical
60/40 money-weighted portfolio, equity is so much more volatile than debt that it can end up
contributing 80–90% of the portfolio's total risk, even though it's only 60% of the money. Risk
parity deliberately balances the *risk contribution* of each asset class instead of the money amount,
so that no single asset class dominates how the whole portfolio behaves.

## How it works in practice

1. Start with a set of asset classes that tend to perform differently depending on the economic
   environment — commonly equity (does well in growth), long-duration government bonds (does well
   when growth slows and rates fall), and sometimes gold or commodities (does well during unexpected
   inflation).
2. Estimate how volatile each asset class is on its own.
3. Size the allocation to each asset class so that its *contribution to total portfolio risk* is
   roughly equal, not its contribution to total portfolio money. In practice, this usually means
   holding a much larger money-percentage in lower-volatility assets like bonds than a traditional
   60/40 portfolio would, specifically to bring their risk contribution up to parity with equity.
4. Because a pure risk-parity mix that leans heavily on lower-volatility assets can have a lower
   expected return than an all-equity portfolio, some risk parity implementations use modest leverage
   on the lower-risk assets to bring the overall expected return back up while keeping the balanced
   risk structure. A simplified, retail-appropriate version of the idea, without leverage, simply aims
   for a more balanced risk contribution across asset classes than a plain money-weighted split would
   give.

## Where the idea comes from

Risk parity is most closely associated with Bridgewater Associates' "All Weather" strategy, developed
starting in the 1990s, which explicitly aims to perform reasonably across four economic
environments — rising growth, falling growth, rising inflation, and falling inflation — rather than
betting on any one environment. See [Bridgewater Associates — The All Weather Strategy](https://www.bridgewater.com/research-and-insights/the-all-weather-strategy) and [Wikipedia — Risk Parity](https://en.wikipedia.org/wiki/Risk_parity) for background.

## What it's trying to solve

A conventional money-weighted portfolio can look diversified on paper (multiple asset classes present)
while still behaving almost entirely like its riskiest component in practice, because that component
dominates the risk even at a minority money share. Risk parity's goal is a portfolio whose actual
day-to-day and year-to-year behavior is genuinely influenced by all its components, not just the most
volatile one — intended to reduce the chance of a single bad environment (e.g., a sharp equity
drawdown) dominating the outcome.

## Who this framework tends to suit

An investor whose priority is smoother, more consistent behavior across different economic
environments, who is willing to accept that a more balanced-risk portfolio may sometimes lag a pure
equity portfolio during strong bull markets, in exchange for typically smaller and shorter drawdowns
during downturns. It suits someone prioritizing capital preservation and steadiness over the highest
possible long-run growth rate.

## What it deliberately does not do

- It does not try to predict which economic environment is coming next — it aims to be reasonably
  prepared for any of them simultaneously.
- It does not concentrate in a small number of high-conviction bets — balance across risk sources is
  the entire point.
- Retail, unleveraged approximations of the idea will not exactly replicate an institutional risk
  parity fund's return profile, since real risk parity implementations often use leverage and
  derivatives not typically accessible to individual investors through plain mutual funds.
