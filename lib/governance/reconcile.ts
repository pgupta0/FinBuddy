// Combines the model's self-reported compliance block with the deterministic
// checks into the final record for the audit log and review queue (skill
// Sections 0, 4, 10, 11). Rules applied:
//   - the stricter label wins (code vs model vs input floor);
//   - RED, low confidence, unresolved AMBER and the input-side triggers always
//     escalate;
//   - code finding something worse than the model reported = rule_model_mismatch;
//   - a hard RED found by code that the model did not redirect is WITHHELD
//     from the user and replaced by the standard Educational Redirect.

import {
  checkInput,
  checkOutput,
  inputLabelFloor,
  REPEATED_ADVICE_THRESHOLD,
  RULES_VERSION,
  SKILL_VERSION,
  type OutputHit,
} from "./checks";
import {
  parseComplianceBlock,
  stripComplianceBlocks,
  stricterLabel,
  labelRank,
  type ComplianceBlock,
  type Label,
} from "./compliance-block";

export interface GovernanceTurnInput {
  /** Latest user message text (raw; masked before it is stored). */
  userText: string;
  /** Number of advice requests in the session INCLUDING this turn. */
  adviceRequestCount: number;
  /** Full assistant answer text for this turn, compliance block included. */
  answerText: string;
  /** scoreRiskProfile / fundRecommendations ran this turn (skill Section 5.1). */
  quizExceptionActive: boolean;
  /** Number of sources cited or retrieved this turn. */
  sourceCount: number;
}

export interface GovernanceRecord {
  skill_version: string;
  rules_version: string;
  label: Label;
  model_label: Label | null;
  code_label: Label;
  input_floor: Label;
  query_type: string;
  rubric_hits: string[];
  rules_triggered: string[];
  code_hits: OutputHit[];
  action_taken: string;
  /** True when the app replaced the answer with the safe redirect. */
  withheld: boolean;
  /** True when the app appended the standard disclaimer for the user. */
  disclaimer_appended: boolean;
  input_flags: string[];
  pii_detected: boolean;
  pii_types: string[];
  consent: string;
  gaps: ComplianceBlock["gaps"];
  needs_human_review: boolean;
  review_reasons: string[];
  confidence: string;
  rationale: string;
  model_block_error?: string;
  sources_used: ComplianceBlock["sources_used"];
}

/** What the browser receives — the label and user-facing actions only. */
export interface ClientComplianceData {
  label: Label;
  withheld: boolean;
  appendDisclaimer: boolean;
}

export function evaluateTurn(input: GovernanceTurnInput): GovernanceRecord {
  const inputCheck = checkInput(input.userText);
  const flags = new Set(inputCheck.flags);
  const reviewReasons = new Set<string>(inputCheck.reviewReasons);

  const { block, error } = parseComplianceBlock(input.answerText);
  const visibleText = stripComplianceBlocks(input.answerText);

  const out = checkOutput(visibleText, {
    quizExceptionActive: input.quizExceptionActive,
    hasSources: input.sourceCount > 0,
  });

  const inputFloor = inputLabelFloor([...flags]);
  const modelLabel: Label | null = block?.label ?? null;

  let label: Label = stricterLabel(out.label, inputFloor);
  if (modelLabel) label = stricterLabel(label, modelLabel);

  // Section 5.1 — quiz exception turns are at least AMBER and reviewed until signed off.
  const rulesTriggered = new Set<string>([...(block?.rules_triggered ?? []), ...out.rulesTriggered]);
  if (input.quizExceptionActive) {
    label = stricterLabel(label, "AMBER");
    rulesTriggered.add("E-1");
    reviewReasons.add("quiz_exception");
  }

  // Missing / unparseable block: the self-check did not happen.
  if (!block) {
    label = stricterLabel(label, "AMBER");
    reviewReasons.add("rule_model_mismatch");
  } else if (labelRank(out.label) > labelRank(block.label)) {
    // Code found something the model did not report.
    reviewReasons.add("rule_model_mismatch");
  }

  // Hard RED found by code in the delivered text => do not deliver it.
  const modelRedirected =
    block?.action_taken === "redirected" || block?.action_taken === "rewritten" || block?.action_taken === "blocked";
  const withheld = out.hardRed;
  let actionTaken = block?.action_taken ?? "delivered";
  if (withheld) actionTaken = "blocked";

  if (label === "RED") reviewReasons.add("red_output");
  if (label === "AMBER" && !modelRedirected && out.hits.length > 0) reviewReasons.add("amber_unresolved");

  if (input.adviceRequestCount >= REPEATED_ADVICE_THRESHOLD && flags.has("advice_request")) {
    reviewReasons.add("repeated_advice_seeking");
  }
  if (flags.has("pii_shared")) reviewReasons.add("pii_shared");

  const confidence = block?.confidence ?? "low";
  if (confidence === "low") reviewReasons.add("low_confidence");

  const gaps = block?.gaps ?? { missing: [], conflicting: [], unclear: [], stale: [], outside_authority: [] };
  if (gaps.conflicting.length > 0) reviewReasons.add("conflicting_sources");
  const outsideAuthority = [...new Set([...gaps.outside_authority, ...inputCheck.outsideAuthority])];

  if (block?.needs_human_review && block.review_reason) reviewReasons.add(block.review_reason);

  const piiTypes = [...new Set([...inputCheck.piiTypes, ...(block?.pii_types ?? [])])];

  return {
    skill_version: SKILL_VERSION,
    rules_version: RULES_VERSION,
    label,
    model_label: modelLabel,
    code_label: out.label,
    input_floor: inputFloor,
    query_type: block?.query_type ?? (flags.has("advice_request") ? "advice_request" : "other"),
    rubric_hits: [...new Set([...(block?.rubric_hits ?? []), ...out.rubricHits])],
    rules_triggered: [...rulesTriggered],
    code_hits: out.hits,
    action_taken: actionTaken,
    withheld,
    disclaimer_appended: !withheld && out.disclaimerMissing,
    input_flags: [...new Set([...flags, ...(block?.input_flags ?? [])])],
    pii_detected: piiTypes.length > 0,
    pii_types: piiTypes,
    consent: block?.consent ?? "not_requested",
    gaps: { ...gaps, outside_authority: outsideAuthority },
    needs_human_review: reviewReasons.size > 0 || Boolean(block?.needs_human_review),
    review_reasons: [...reviewReasons],
    confidence,
    rationale: block?.rationale ?? "",
    ...(error ? { model_block_error: error } : {}),
    sources_used: block?.sources_used ?? [],
  };
}

export function toClientData(r: GovernanceRecord): ClientComplianceData {
  return { label: r.label, withheld: r.withheld, appendDisclaimer: r.disclaimer_appended };
}
