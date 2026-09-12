// lib/groww-auth.ts
//
// Server-only auth helper for Groww's Trading API, used solely to show a
// live reference price next to real stock/REIT/InvIT holdings in the
// fund-recommendation cards (see app/api/holdings-price/route.ts). This is a
// deterministic, LLM-free feature — the model never sees or narrates this
// data — so it carries none of the "never let the model invent a number"
// risk the rest of this app is built around; it either shows a real live
// price or shows nothing.
//
// Deliberately dependency-free: TOTP (RFC 6238) is implemented by hand with
// Node's built-in `crypto` module rather than adding a package, so enabling
// this feature never touches package.json/package-lock.json.
//
// Requires two env vars, both generated once from the Groww API dashboard
// (groww.in/trade-api/api-keys → "Generate API Key" → "Generate TOTP Token"),
// which itself requires an active Groww trading account plus a paid Trading
// API subscription:
//   GROWW_API_KEY      — the long-lived API key
//   GROWW_TOTP_SECRET  — the base32 TOTP seed paired with that key
// If either is missing, getGrowwAccessToken() returns null — callers must
// treat null as "feature unavailable" and degrade gracefully, never throw.

import { createHmac } from "crypto";

const TOKEN_URL = "https://api.groww.in/v1/token/api/access";

let cachedToken: { token: string; expiresAt: number } | null = null;

function base32Decode(base32: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = base32.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue; // ignore stray whitespace/formatting chars
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** RFC 6238 TOTP — 30s step, 6 digits, SHA-1 — matches Groww's dashboard seed. */
function generateTotp(secretBase32: string): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binCode % 1_000_000).toString().padStart(6, "0");
}

/**
 * Returns a valid Groww access token, generating a fresh one when the cached
 * one is missing/expired. Per Groww's docs, access tokens expire daily at
 * 6:00 AM IST regardless of when they were issued — this cache just avoids
 * regenerating one on every request within that window (best-effort only:
 * a serverless cold start starts with an empty cache, which is fine, it
 * just means one extra token request).
 *
 * Returns null — never throws — if credentials aren't configured or the
 * token request fails for any reason.
 */
export async function getGrowwAccessToken(): Promise<string | null> {
  const apiKey = process.env.GROWW_API_KEY;
  const totpSecret = process.env.GROWW_TOTP_SECRET;
  if (!apiKey || !totpSecret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key_type: "totp", totp: generateTotp(totpSecret) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { token?: string; expiry?: string };
    if (!data.token) return null;

    // Cache until Groww's stated expiry (refreshed 5 min early), or 6 hours
    // from now if that field is missing/unparseable.
    const parsedExpiry = data.expiry ? Date.parse(data.expiry) : NaN;
    const fallbackExpiry = Date.now() + 6 * 60 * 60 * 1000;
    const expiresAt = (Number.isFinite(parsedExpiry) ? parsedExpiry : fallbackExpiry) - 5 * 60 * 1000;

    cachedToken = { token: data.token, expiresAt };
    return data.token;
  } catch {
    return null;
  }
}
