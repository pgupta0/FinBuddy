// Client-side view of an assistant message under the governance skill: strips
// the machine-readable compliance block, and applies the server's verdict
// (the `data-compliance` stream part) — replacing a withheld RED draft with
// the standard Educational Redirect, or appending a missing disclaimer.

import type { UIMessage } from "ai";
import { stripComplianceBlocks } from "./compliance-block";
import { STANDARD_DISCLAIMER, WITHHELD_REDIRECT } from "./constants";
import type { ClientComplianceData } from "./reconcile";

export function getComplianceData(message: UIMessage): ClientComplianceData | undefined {
  const part = message.parts.find((p) => p.type === "data-compliance") as
    | { type: "data-compliance"; data: ClientComplianceData }
    | undefined;
  return part?.data;
}

/** The text a user should see (and copy / export) for an assistant message. */
export function visibleAssistantText(message: UIMessage): string {
  const compliance = getComplianceData(message);
  if (compliance?.withheld) return WITHHELD_REDIRECT;
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => stripComplianceBlocks((p as { text: string }).text))
    .join("\n\n")
    .trim();
  if (compliance?.appendDisclaimer && text) return `${text}\n\n*${STANDARD_DISCLAIMER}*`;
  return text;
}
