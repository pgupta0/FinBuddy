// Audit log and human review queue (skill Sections 9.3 and 11).
//
// Every turn produces one record. Personal identifiers are masked before
// anything is written. Two sinks:
//   1. Always: one structured JSON line on stdout ("GOVERNANCE_AUDIT ..."),
//      which lands in the hosting platform's logs.
//   2. When UPSTASH_REDIS_REST_URL/TOKEN are set (the same store the rate
//      limiter uses): each record is stored under governance:audit:<id> with a
//      TTL of GOVERNANCE_LOG_RETENTION_DAYS, its id is pushed to
//      governance:audit:index, and records needing review are also pushed to
//      governance:review_queue for the Compliance reviewer.
// Logging never blocks or breaks a chat response.

import { nanoid } from "nanoid";
import { maskPII } from "./checks";
import type { GovernanceRecord } from "./reconcile";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const RETENTION_DAYS = (() => {
  const n = Number(process.env.GOVERNANCE_LOG_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90;
})();
const INDEX_MAX = 10_000;

export interface AuditEntry extends GovernanceRecord {
  id: string;
  timestamp: string;
  session_id: string;
  vendor: string;
  model_id: string;
  user_text_masked: string;
  answer_text_masked: string;
}

export function buildAuditEntry(
  record: GovernanceRecord,
  ctx: {
    sessionId: string;
    vendor: string;
    modelId: string;
    userText: string;
    visibleAnswer: string;
  }
): AuditEntry {
  return {
    id: nanoid(),
    timestamp: new Date().toISOString(),
    session_id: ctx.sessionId,
    vendor: ctx.vendor,
    model_id: ctx.modelId,
    user_text_masked: maskPII(ctx.userText).slice(0, 2000),
    answer_text_masked: maskPII(ctx.visibleAnswer).slice(0, 6000),
    ...record,
  };
}

export async function writeAuditEntry(entry: AuditEntry): Promise<void> {
  try {
    console.info("GOVERNANCE_AUDIT " + JSON.stringify(entry));
  } catch {
    // never throw from logging
  }

  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;

  const key = `governance:audit:${entry.id}`;
  const commands: string[][] = [
    ["SET", key, JSON.stringify(entry), "EX", String(RETENTION_DAYS * 86_400)],
    ["LPUSH", "governance:audit:index", entry.id],
    ["LTRIM", "governance:audit:index", "0", String(INDEX_MAX - 1)],
  ];
  if (entry.needs_human_review) {
    commands.push(["LPUSH", "governance:review_queue", entry.id]);
  }

  try {
    await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(2000),
    });
  } catch (err) {
    console.warn("GOVERNANCE_AUDIT: store write failed", err instanceof Error ? err.message : err);
  }
}
