// Per-turn governance note for the model. The deterministic input checks run
// before the model sees the message (skill Section 7.1 step 1); their result is
// passed in as a short system note so the model's own handling and its
// compliance block start from the same facts the code found. Kept OUT of the
// cached system-prompt prefix because it changes every turn.

import { REPEATED_ADVICE_THRESHOLD, type InputCheckResult } from "./checks";

export function buildGovernanceTurnNote(check: InputCheckResult, adviceRequestCount: number): string {
  const lines: string[] = [];
  if (check.flags.length > 0) {
    lines.push(`Input flags from the app's deterministic checks: ${check.flags.join(", ")}.`);
  }
  if (check.piiTypes.length > 0) {
    lines.push(
      `The user's latest message contained personal identifiers (${check.piiTypes.join(", ")}); they have been replaced with [... REDACTED] placeholders. Do not ask for or repeat them; use the I-2 reply. Set pii_detected true with these types.`
    );
  }
  if (adviceRequestCount >= REPEATED_ADVICE_THRESHOLD && check.flags.includes("advice_request")) {
    lines.push(
      `This is advice request number ${adviceRequestCount} in this session: keep redirecting politely, suggest a SEBI-registered Investment Adviser, and set needs_human_review true with review_reason "repeated_advice_seeking" (R-14).`
    );
  }
  if (lines.length === 0) return "";
  return `[Governance check for this turn]\n${lines.join("\n")}`;
}
