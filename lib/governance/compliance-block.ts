// Parsing and stripping of the machine-readable ```compliance block the model
// appends to every answer (skill Section 10). Client-safe: no server imports.

import { z } from "zod";

export const LABELS = ["GREEN", "AMBER", "RED"] as const;
export type Label = (typeof LABELS)[number];

const gapsSchema = z.object({
  missing: z.array(z.string()).default([]),
  conflicting: z.array(z.string()).default([]),
  unclear: z.array(z.string()).default([]),
  stale: z.array(z.string()).default([]),
  outside_authority: z.array(z.string()).default([]),
});

/**
 * Lenient on purpose: a model that gets one field slightly wrong should still
 * yield a usable record. Anything missing is defaulted, and the reconciler
 * treats a missing or unparseable block as a mismatch to escalate.
 */
export const complianceBlockSchema = z.object({
  skill_version: z.string().optional(),
  label: z.preprocess((v) => (typeof v === "string" ? v.toUpperCase().trim() : v), z.enum(LABELS)),
  query_type: z.string().default("other"),
  rubric_hits: z.array(z.string()).default([]),
  rules_triggered: z.array(z.string()).default([]),
  action_taken: z.string().default("delivered"),
  sources_used: z
    .array(
      z.object({
        id: z.string(),
        detail: z.string().optional(),
        data_date: z.string().nullable().optional(),
      })
    )
    .default([]),
  input_flags: z.array(z.string()).default([]),
  pii_detected: z.boolean().default(false),
  pii_types: z.array(z.string()).default([]),
  consent: z.string().default("not_requested"),
  gaps: gapsSchema.default({
    missing: [],
    conflicting: [],
    unclear: [],
    stale: [],
    outside_authority: [],
  }),
  needs_human_review: z.boolean().default(false),
  review_reason: z.string().nullable().default(null),
  confidence: z.string().default("medium"),
  rationale: z.string().default(""),
});
export type ComplianceBlock = z.infer<typeof complianceBlockSchema>;

// A complete block, or one still being streamed (no closing fence yet).
const BLOCK_RE = /```\s*compliance\b[\s\S]*?(```|$)/gi;
// The opening fence itself may arrive in pieces while streaming: "``", "```c",
// "```compl"... Strip any trailing prefix of "```compliance".
const PARTIAL_FENCE = "```compliance";

/** Remove every compliance block (complete or still streaming) from display text. */
export function stripComplianceBlocks(text: string): string {
  let out = text.replace(BLOCK_RE, "");
  for (let n = PARTIAL_FENCE.length - 1; n >= 2; n--) {
    if (out.endsWith(PARTIAL_FENCE.slice(0, n))) {
      out = out.slice(0, -n);
      break;
    }
  }
  return out.replace(/\s+$/, (ws) => (ws.includes("\n") ? "\n" : ws));
}

/** Parse the LAST complete compliance block in the text, if any. */
export function parseComplianceBlock(
  text: string
): { block: ComplianceBlock | null; error?: string } {
  const matches = [...text.matchAll(/```\s*compliance\b\s*([\s\S]*?)```/gi)];
  if (matches.length === 0) return { block: null, error: "missing" };
  const raw = matches[matches.length - 1][1].trim();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { block: null, error: "invalid_json" };
  }
  const parsed = complianceBlockSchema.safeParse(json);
  if (!parsed.success) return { block: null, error: "schema" };
  return { block: parsed.data };
}

export function labelRank(l: Label): number {
  return LABELS.indexOf(l);
}

export function stricterLabel(a: Label, b: Label): Label {
  return labelRank(a) >= labelRank(b) ? a : b;
}
