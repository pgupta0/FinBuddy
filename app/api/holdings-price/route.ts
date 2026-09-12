// app/api/holdings-price/route.ts
//
// Optional, best-effort live-price lookup for the real stock/REIT/InvIT
// holdings shown under each fund in the fund-recommendation cards (see
// components/messages/fund-recommendations-card.tsx). Purely a UI
// decoration — the LLM never sees or calls this route, so it carries no
// hallucination risk: it either shows a real live price from Groww, or it
// shows nothing at all.
//
// Gated behind ENABLE_LIVE_HOLDING_PRICES (config.ts) and valid
// GROWW_API_KEY / GROWW_TOTP_SECRET env vars (lib/groww-auth.ts). With
// either missing, or on any upstream failure, this responds
// { available: false, prices: {} } rather than an error status — the
// feature degrades to "no live prices" instead of breaking the chat UI.

import { ENABLE_LIVE_HOLDING_PRICES } from "@/config";
import { getGrowwAccessToken } from "@/lib/groww-auth";

// Generous headroom over the (now much longer, ~60%-of-portfolio) holdings
// lists a single card can show across several funds — just a sane cap
// against a malformed/abusive query string. This is one batched LTP call
// regardless of count, so raising this is cheap (Groww's LTP endpoint
// accepts many symbols per request; rate limit is per-request, not per-symbol).
const MAX_SYMBOLS = 250;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("symbols") ?? "";
  const symbols = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    ),
  ].slice(0, MAX_SYMBOLS);

  if (!ENABLE_LIVE_HOLDING_PRICES || symbols.length === 0) {
    return Response.json({ available: false, prices: {} });
  }

  const token = await getGrowwAccessToken();
  if (!token) {
    return Response.json({ available: false, prices: {} });
  }

  try {
    const exchangeSymbols = symbols.map((s) => `NSE_${s}`).join(",");
    const quoteUrl = `https://api.groww.in/v1/live-data/ltp?segment=CASH&exchange_symbols=${encodeURIComponent(exchangeSymbols)}`;
    const res = await fetch(quoteUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-API-VERSION": "1.0",
      },
      // Live prices are a "nice to have" decoration only — never let a slow
      // upstream call hold up the chat UI.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return Response.json({ available: false, prices: {} });
    }

    const data = (await res.json()) as { status?: string; payload?: Record<string, number> };
    if (data.status !== "SUCCESS" || !data.payload) {
      return Response.json({ available: false, prices: {} });
    }

    const prices: Record<string, number> = {};
    for (const [key, value] of Object.entries(data.payload)) {
      const symbol = key.replace(/^NSE_/, "");
      if (typeof value === "number") prices[symbol] = value;
    }

    return Response.json({ available: true, prices, asOf: new Date().toISOString() });
  } catch {
    return Response.json({ available: false, prices: {} });
  }
}
