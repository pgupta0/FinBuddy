// Deterministic governance checks (skill Sections 4-6), driven entirely by
// governance/rules.json. The model's self-assessment is never the only check
// (skill Section 0): these run on every turn and the stricter result wins.

import rules from "@/governance/rules.json";
import type { Label } from "./compliance-block";

export const SKILL_VERSION: string = rules.skill_version;
export const RULES_VERSION: string = rules.rules_version;
export const REPEATED_ADVICE_THRESHOLD: number = rules.session.repeated_advice_threshold;

const re = (p: string, flags = "i") => new RegExp(p, flags);
const NEGATION = re(rules.negation.pattern);
const NEGATION_WINDOW = rules.negation.window_chars;

interface CompiledOutputRule {
  id: string;
  rubric: string;
  rule: string;
  severity: "red" | "amber";
  negatable: boolean;
  quizException: boolean;
  patterns: RegExp[];
}

const OUTPUT_RULES: CompiledOutputRule[] = rules.output_rules.map((r) => ({
  id: r.id,
  rubric: r.rubric,
  rule: r.rule,
  severity: r.severity as "red" | "amber",
  negatable: Boolean(r.negatable),
  quizException: Boolean((r as { quiz_exception?: boolean }).quiz_exception),
  patterns: r.patterns.map((p) => re(p, "gi")),
}));

const FACT_SIGNAL = re(rules.grounding.fact_signal);
const CITATION = re(rules.grounding.citation);
const DISCLAIMER_PRESENT = rules.disclaimer.present_patterns.map((p) => re(p));
const SUBSTANTIVE_SIGNAL = re(rules.disclaimer.substantive_signal);

interface CompiledInputRule {
  id: string;
  flag: string;
  alsoFlags: string[];
  reviewReason?: string;
  outsideAuthority?: string;
  patterns: RegExp[];
}

const INPUT_RULES: CompiledInputRule[] = rules.input_rules.map((r) => {
  const x = r as typeof r & {
    also_flags?: string[];
    review_reason?: string;
    outside_authority?: string;
  };
  return {
    id: x.id,
    flag: x.flag,
    alsoFlags: x.also_flags ?? [],
    reviewReason: x.review_reason,
    outsideAuthority: x.outside_authority,
    patterns: x.patterns.map((p) => re(p)),
  };
});

const PII_RULES = rules.pii.map((p) => ({ type: p.type, pattern: re(p.pattern, "gi") }));

// ---------------------------------------------------------------------------
// PII (skill Section 6 I-2, Section 9)
// ---------------------------------------------------------------------------

/** Detect personal identifiers. Returns the TYPES only — never the values. */
export function detectPII(text: string): string[] {
  const types = new Set<string>();
  for (const { type, pattern } of PII_RULES) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) types.add(type);
  }
  return [...types];
}

/** Replace every personal identifier with a typed placeholder, e.g. [PAN REDACTED]. */
export function maskPII(text: string): string {
  let out = text;
  for (const { type, pattern } of PII_RULES) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, `[${type.toUpperCase().replace(/_/g, " ")} REDACTED]`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Input-side checks (skill Section 6)
// ---------------------------------------------------------------------------

export interface InputCheckResult {
  flags: string[];
  piiTypes: string[];
  reviewReasons: string[];
  outsideAuthority: string[];
  /** Matched rule ids, for the audit log. */
  ruleIds: string[];
}

export function checkInput(text: string): InputCheckResult {
  const flags = new Set<string>();
  const reviewReasons = new Set<string>();
  const outsideAuthority = new Set<string>();
  const ruleIds: string[] = [];

  for (const r of INPUT_RULES) {
    if (r.patterns.some((p) => p.test(text))) {
      ruleIds.push(r.id);
      flags.add(r.flag);
      r.alsoFlags.forEach((f) => flags.add(f));
      if (r.reviewReason) reviewReasons.add(r.reviewReason);
      if (r.outsideAuthority) outsideAuthority.add(r.outsideAuthority);
    }
  }

  const piiTypes = detectPII(text);
  if (piiTypes.length > 0) {
    flags.add("pii_shared");
    ruleIds.push("I-2");
  }
  if (flags.has("regulatory_question")) {
    outsideAuthority.add("FinBuddy compliance team / lawyer");
  }

  return {
    flags: [...flags],
    piiTypes,
    reviewReasons: [...reviewReasons],
    outsideAuthority: [...outsideAuthority],
    ruleIds,
  };
}

/** Number of user messages in the session that were advice requests (R-14). */
export function countAdviceRequests(userTexts: string[]): number {
  return userTexts.filter((t) => checkInput(t).flags.includes("advice_request")).length;
}

/**
 * The minimum label a turn can carry given what the user asked (skill Section
 * 14 expectations): an advice request or bypass attempt is a RED query even
 * when the answer is a clean redirect; scope, PII, distress and grievance
 * turns are at least AMBER.
 */
export function inputLabelFloor(flags: string[]): Label {
  if (flags.includes("advice_request") || flags.includes("bypass_attempt")) return "RED";
  const amber = [
    "pii_shared",
    "vulnerable_user",
    "grievance",
    "regulatory_question",
    "tax_legal_question",
    "recent_data_request",
  ];
  if (flags.some((f) => amber.includes(f))) return "AMBER";
  return "GREEN";
}

// ---------------------------------------------------------------------------
// Output-side checks (skill Sections 4-5)
// ---------------------------------------------------------------------------

export interface OutputHit {
  id: string;
  rubric: string;
  rule: string;
  severity: "red" | "amber";
  /** Short excerpt of the matched text (assistant text only; never user PII). */
  excerpt: string;
}

export interface OutputCheckOptions {
  /** A quiz-flow tool (scoreRiskProfile / fundRecommendations) ran this turn — skill Section 5.1. */
  quizExceptionActive?: boolean;
  /** Sources were retrieved or cited this turn (grounding check, Q9). */
  hasSources?: boolean;
}

export interface OutputCheckResult {
  label: Label;
  hits: OutputHit[];
  rubricHits: string[];
  rulesTriggered: string[];
  /** Hard (Q1-Q6) hits found by code. */
  hardRed: boolean;
  disclaimerMissing: boolean;
  /** Rules that would have fired but were relaxed by the quiz exception. */
  relaxedByException: string[];
}

function negatedBefore(text: string, index: number): boolean {
  const start = Math.max(0, index - NEGATION_WINDOW);
  const before = text.slice(start, index);
  // Only look within the current sentence.
  const sentenceStart = Math.max(
    before.lastIndexOf("."),
    before.lastIndexOf("!"),
    before.lastIndexOf("?"),
    before.lastIndexOf("\n")
  );
  const window = sentenceStart >= 0 ? before.slice(sentenceStart + 1) : before;
  return NEGATION.test(window);
}

/** True when the text carries the standard (or short) disclaimer. */
export function hasDisclaimer(text: string): boolean {
  return DISCLAIMER_PRESENT.some((p) => p.test(text));
}

export function isSubstantive(text: string): boolean {
  return text.length >= rules.disclaimer.substantive_min_chars && SUBSTANTIVE_SIGNAL.test(text);
}

export function checkOutput(text: string, opts: OutputCheckOptions = {}): OutputCheckResult {
  const hits: OutputHit[] = [];
  const relaxed = new Set<string>();

  for (const r of OUTPUT_RULES) {
    for (const p of r.patterns) {
      p.lastIndex = 0;
      let m: RegExpExecArray | null;
      let matched = false;
      while ((m = p.exec(text)) !== null) {
        if (m[0].length === 0) {
          p.lastIndex++;
          continue;
        }
        if (r.negatable && negatedBefore(text, m.index)) continue;
        matched = true;
        if (opts.quizExceptionActive && r.quizException) {
          relaxed.add(r.rule);
          break;
        }
        hits.push({
          id: r.id,
          rubric: r.rubric,
          rule: r.rule,
          severity: r.severity,
          excerpt: m[0].slice(0, 120),
        });
        break;
      }
      if (matched) break;
    }
  }

  // Q9 — fund facts with numbers but no citation anywhere in the answer.
  if (FACT_SIGNAL.test(text) && !CITATION.test(text) && !opts.hasSources) {
    hits.push({
      id: "Q9-uncited",
      rubric: rules.grounding.rubric,
      rule: rules.grounding.rule,
      severity: "amber",
      excerpt: "",
    });
  }

  // Q11 — disclaimer missing from a substantive answer.
  const disclaimerMissing = isSubstantive(text) && !hasDisclaimer(text);
  if (disclaimerMissing) {
    hits.push({
      id: "Q11-disclaimer",
      rubric: rules.disclaimer.rubric,
      rule: rules.disclaimer.rule,
      severity: "amber",
      excerpt: "",
    });
  }

  const hardRed = hits.some((h) => h.severity === "red");
  const label: Label = hardRed ? "RED" : hits.length > 0 ? "AMBER" : "GREEN";

  return {
    label,
    hits,
    rubricHits: [...new Set(hits.map((h) => h.rubric))],
    rulesTriggered: [...new Set(hits.map((h) => h.rule))],
    hardRed,
    disclaimerMissing,
    relaxedByException: [...relaxed],
  };
}
