/**
 * HMAC signing for the compaction summary round-trip.
 *
 * The server generates conversation summaries and the client stores and
 * returns them on later requests (X-Compacted-Summary header). Without a
 * signature, that header is a forgeable injection channel: any client could
 * send arbitrary text that enters the model context framed as trusted
 * conversation history, bypassing moderation (which only checks the latest
 * user message). Signing lets clients round-trip summaries but not forge or
 * edit them.
 *
 * The MAC covers both the summary text and summarizedUpTo, so neither can be
 * altered independently. Server-only module — never import from client code.
 */

import { createHmac, createHash, timingSafeEqual } from "crypto";
import { providerSpec, type Vendor } from "@/lib/ai/providers";

// Dedicated secret if set; otherwise derived (via SHA-256, never used raw) from
// whichever provider API key the server has.
//
// The base template derived this from ANTHROPIC_API_KEY specifically, on the
// assumption that key always exists. It no longer does — the app can run on a
// Gemini or OpenAI key alone — and an empty secret would have made every
// signature forgeable, which is the exact attack this module exists to stop.
// So the key is derived from the first configured provider in a FIXED order
// (not PROVIDER_FALLBACK_ORDER, which is configurable and would change the
// secret when someone reorders it), and the absence of any key is fatal rather
// than silently weak.
//
// Rotating a key invalidates outstanding signatures — harmless: an invalid
// signature just makes the server ignore the client's summary and recompact
// from the full message history.
const SECRET_SOURCE_ORDER: Vendor[] = [
  "anthropic",
  "openai",
  "google",
  "fireworks",
];

function getKey(): Buffer {
  let secret = process.env.SUMMARY_HMAC_SECRET;

  if (!secret) {
    for (const vendor of SECRET_SOURCE_ORDER) {
      const value = process.env[providerSpec(vendor).envKey];
      if (value && value.trim().length > 0) {
        secret = value;
        break;
      }
    }
  }

  if (!secret) {
    throw new Error(
      "Cannot sign compaction summaries: set SUMMARY_HMAC_SECRET, or configure at least one provider API key."
    );
  }

  return createHash("sha256").update(`summary-hmac:${secret}`).digest();
}

export function signSummary(summary: string, summarizedUpTo: number): string {
  return createHmac("sha256", getKey())
    .update(`${summarizedUpTo}\n${summary}`)
    .digest("hex");
}

export function verifySummary(
  summary: string,
  summarizedUpTo: number,
  signature: string | null
): boolean {
  if (!signature) return false;
  const expected = signSummary(summary, summarizedUpTo);
  const got = Buffer.from(signature, "utf8");
  const want = Buffer.from(expected, "utf8");
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}
