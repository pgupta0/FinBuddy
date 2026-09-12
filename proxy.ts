import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  RATE_LIMIT_ENABLED,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_STORE_FAIL_POLICY,
} from "@/config";

/**
 * Per-IP rate limiting for /api/chat.
 *
 * Two backends:
 *
 *  1. SHARED (preferred) — Upstash Redis over its REST API, used automatically
 *     when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set. One
 *     counter per IP per window, shared by every serverless instance, so the
 *     configured limit is the real limit. Deliberately called with plain
 *     `fetch` rather than the @upstash/redis package: it is two HTTP calls in a
 *     pipeline, and the proxy runs on every chat request, so there is no reason
 *     to add a dependency to the edge bundle.
 *
 *  2. IN-MEMORY (fallback) — a sliding window in this instance's memory. This
 *     is what the base template shipped, and on Vercel it is weaker than it
 *     looks: each concurrent instance keeps its own Map, so the effective
 *     ceiling is the configured limit times the number of warm instances, and
 *     a cold start wipes a client's history. Fine locally and as a speed-bump;
 *     not a quota. The warning below fires once per instance so this is visible
 *     in production logs rather than assumed.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasSharedStore = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

let warnedAboutMemoryStore = false;

// --- In-memory sliding window -----------------------------------------------

const ipRequestLog = new Map<string, number[]>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  for (const [ip, timestamps] of ipRequestLog.entries()) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) ipRequestLog.delete(ip);
    else ipRequestLog.set(ip, valid);
  }
}

function isRateLimitedInMemory(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = ipRequestLog.get(ip) || [];
  const recent = timestamps.filter((t) => t > cutoff);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) return true;

  recent.push(now);
  ipRequestLog.set(ip, recent);
  cleanupExpired();
  return false;
}

// --- Shared store (Upstash Redis REST) --------------------------------------

/**
 * Fixed-window counter: INCR a key bucketed by window, and set its TTL on the
 * first hit. Cheaper and simpler than a sorted-set sliding window (one
 * pipelined round-trip), at the cost of allowing up to 2x the limit across a
 * window boundary — an acceptable trade for an abuse speed-bump.
 *
 * Returns true (limited), false (allowed), or null (store unreachable).
 */
async function isRateLimitedShared(ip: string): Promise<boolean | null> {
  const windowSeconds = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
  const bucket = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
  const key = `ratelimit:chat:${ip}:${bucket}`;

  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(windowSeconds), "NX"],
      ]),
      // Never let the limiter hang a chat request.
      signal: AbortSignal.timeout(1500),
    });

    if (!res.ok) return null;

    const payload = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    const count = Number(payload?.[0]?.result);
    if (!Number.isFinite(count)) return null;

    return count > RATE_LIMIT_MAX_REQUESTS;
  } catch {
    // Network error / timeout / malformed response: the caller applies the policy.
    return null;
  }
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function tooManyRequests() {
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment before trying again." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
    }
  );
}

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/chat")) {
    return NextResponse.next();
  }
  if (!RATE_LIMIT_ENABLED) {
    return NextResponse.next();
  }

  const ip = getClientIP(request);

  if (hasSharedStore) {
    const limited = await isRateLimitedShared(ip);
    if (limited === true) return tooManyRequests();
    if (limited === null && RATE_LIMIT_STORE_FAIL_POLICY === "closed") {
      return tooManyRequests();
    }
    // limited === false, or the store failed under an "open" policy.
    return NextResponse.next();
  }

  if (!warnedAboutMemoryStore) {
    warnedAboutMemoryStore = true;
    console.warn(
      "RATE LIMIT: using in-memory counters (per serverless instance). " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for a limit that actually holds."
    );
  }

  if (isRateLimitedInMemory(ip)) return tooManyRequests();
  return NextResponse.next();
}

export const config = {
  matcher: "/api/chat",
};
