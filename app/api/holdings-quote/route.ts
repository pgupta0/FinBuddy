// app/api/holdings-quote/route.ts
//
// Optional, best-effort "basic stock info" lookup for ONE holding at a time
// (day change, open/high/low/close, volume, 52-week range) — the deeper
// companion to holdings-price/route.ts's batched last-traded-price feed.
//
// Groww's underlying quote endpoint only accepts a single trading_symbol per
// call (unlike the LTP endpoint, which batches many symbols in one request),
// so this is deliberately a lazy, per-click fetch from the UI (see
// components/messages/fund-recommendations-card.tsx) rather than something
// eagerly fetched for every holding in a card — eagerly calling this once
// per holding across a ~60%-of-portfolio holdings list (up to ~40 per fund)
// would mean dozens of sequential API calls for a single card render.
//
// Purely a UI decoration — the LLM never sees or calls this route, so it
// carries no hallucination risk: it either shows real data from Groww, or it
// shows nothing at all. Gated behind the same ENABLE_LIVE_HOLDING_PRICES
// flag and Groww credentials as holdings-price/route.ts.

import { ENABLE_LIVE_HOLDING_PRICES } from "@/config";
import { getGrowwAccessToken } from "@/lib/groww-auth";

interface GrowwQuotePayload {
  last_price?: number;
  day_change?: number;
  day_change_perc?: number;
  ohlc?: { open?: number; high?: number; low?: number; close?: number };
  volume?: number;
  week_52_high?: number;
  week_52_low?: number;
  market_cap?: number;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();

  if (!ENABLE_LIVE_HOLDING_PRICES || !symbol) {
    return Response.json({ available: false });
  }

  const token = await getGrowwAccessToken();
  if (!token) {
    return Response.json({ available: false });
  }

  try {
    const quoteUrl = `https://api.groww.in/v1/live-data/quote?exchange=NSE&segment=CASH&trading_symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(quoteUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-API-VERSION": "1.0",
      },
      // A basic-info popover shouldn't hold up the UI if Groww is slow.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return Response.json({ available: false });
    }

    const data = (await res.json()) as { status?: string; payload?: GrowwQuotePayload };
    if (data.status !== "SUCCESS" || !data.payload) {
      return Response.json({ available: false });
    }

    const p = data.payload;
    return Response.json({
      available: true,
      symbol,
      quote: {
        lastPrice: p.last_price,
        dayChange: p.day_change,
        dayChangePct: p.day_change_perc,
        open: p.ohlc?.open,
        high: p.ohlc?.high,
        low: p.ohlc?.low,
        prevClose: p.ohlc?.close,
        volume: p.volume,
        week52High: p.week_52_high,
        week52Low: p.week_52_low,
      },
      asOf: new Date().toISOString(),
    });
  } catch {
    return Response.json({ available: false });
  }
}
