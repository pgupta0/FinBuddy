"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ShieldCheck, ShieldAlert, ShieldX, UserCheck } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ClientComplianceData } from "@/lib/governance/reconcile";
import type { Label } from "@/lib/governance/compliance-block";

// Plain-English names for the skill's ids (governance/advice-boundary-skill.md).

const LABEL_META: Record<Label, { name: string; meaning: string; icon: typeof ShieldCheck; tone: string; dot: string }> = {
  GREEN: {
    name: "Education",
    meaning: "General, sourced and non-directive.",
    icon: ShieldCheck,
    tone: "text-green-700 dark:text-green-400",
    dot: "bg-green-600 dark:bg-green-500",
  },
  AMBER: {
    name: "Borderline",
    meaning: "Delivered in its safest form; check the items below.",
    icon: ShieldAlert,
    tone: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  RED: {
    name: "Advice",
    meaning: "Advice was requested or drafted; the answer was redirected or withheld.",
    icon: ShieldX,
    tone: "text-red-700 dark:text-red-400",
    dot: "bg-red-600 dark:bg-red-500",
  },
};

const RUBRIC: Record<string, string> = {
  Q1: "Nudges the user to buy, sell, hold, switch or time an investment",
  Q2: "Names a product in a preference context",
  Q3: "Predicts or promises returns, or calls something safe",
  Q4: "Price targets, ratings, rankings or best lists",
  Q5: "Assesses the user's risk tolerance or suitability",
  Q6: "Tells the user how to change their allocation",
  Q7: "Uses recent market price, NAV or return data",
  Q8: "Comparison implies a gap to close",
  Q9: "Fund facts without a citation and date",
  Q10: "Tax, legal or insurance specifics for the user",
  Q11: "Required disclaimer missing",
  Q12: "General, sourced and non-directive",
};

const RULES: Record<string, string> = {
  "R-1": "No action verbs aimed at the user",
  "R-2": "Products named only to describe disclosed data",
  "R-3": "No return promises or predictions",
  "R-4": "No risk profiling or suitability",
  "R-5": "No best lists, ratings, rankings or targets",
  "R-6": "No market timing",
  "R-7": "Data only from approved, dated sources",
  "R-8": "No recent market data in education",
  "R-9": "Tax, legal and insurance: general concepts only",
  "R-10": "Framework comparisons stay neutral",
  "R-11": "Disclaimer on every substantive answer",
  "R-12": "Never claim SEBI, RBI or AMFI registration",
  "R-13": "Not argued out of the rules",
  "R-14": "Repeated advice requests escalate",
  "E-1": "Risk-quiz exception: profile and allocation from the quiz tools",
  "E-2": "Risk-quiz exception: naming funds returned by the tool",
};

const REVIEW_REASONS: Record<string, string> = {
  red_output: "RED label",
  amber_unresolved: "AMBER not resolved",
  low_confidence: "Low confidence",
  rule_model_mismatch: "Code check and model disagree",
  repeated_advice_seeking: "Repeated advice requests",
  vulnerable_user: "Distress or vulnerability",
  grievance: "Complaint or data request",
  conflicting_sources: "Sources conflict",
  regulatory_question: "Regulatory question",
  quiz_exception: "Risk-quiz exception (pending sign-off)",
  pii_shared: "Personal identifier shared",
};

const FLAGS: Record<string, string> = {
  advice_request: "Advice request",
  indirect_advice_request: "Advice for someone else",
  bypass_attempt: "Bypass attempt",
  financial_details: "Financial details shared",
  pii_shared: "Personal identifier shared",
  vulnerable_user: "Vulnerability signal",
  grievance: "Grievance",
  regulatory_question: "Regulatory question",
  tax_legal_question: "Tax or legal question",
  recent_data_request: "Recent market data requested",
};

const GAP_NAMES: Record<string, string> = {
  missing: "Missing data",
  conflicting: "Conflicting sources",
  unclear: "Unclear question",
  stale: "Stale data",
  outside_authority: "Needs a human expert",
};

const ACTIONS: Record<string, string> = {
  delivered: "Delivered",
  rewritten: "Rewritten before delivery",
  redirected: "Redirected to education",
  blocked: "Withheld; standard redirect shown",
};

const PII_NAMES: Record<string, string> = {
  pan: "PAN",
  aadhaar: "Aadhaar",
  ifsc: "IFSC code",
  email: "email",
  phone: "phone number",
  demat_account: "demat account number",
  date_of_birth: "date of birth",
  account_or_folio_number: "account or folio number",
};

const human = (s: string) => s.replace(/_/g, " ");

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-0.5 py-1.5 text-xs max-sm:grid-cols-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="mr-1 mb-1 inline-flex items-center rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[11px] leading-tight"
    >
      {children}
    </span>
  );
}

function LabelText({ label }: { label: Label | null }) {
  if (!label) return <span className="text-muted-foreground">not reported</span>;
  return <span className={cn("font-medium", LABEL_META[label].tone)}>{label}</span>;
}

/**
 * Per-answer Compliance View (governance skill Sections 4, 8, 10, 11). A pill
 * showing the turn's final label; expands to the detail behind it. Rendered
 * only when the server sent detail (COMPLIANCE_VIEW not "off").
 */
export function ComplianceView({ data }: { data: ClientComplianceData }) {
  const [isOpen, setIsOpen] = useState(false);
  const d = data.details;
  if (!d) return null;

  const meta = LABEL_META[data.label];
  const Icon = meta.icon;
  const gaps = Object.entries(d.gaps).filter(([, v]) => v.length > 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        aria-label={`Compliance: ${data.label}, ${meta.name}. ${isOpen ? "Hide" : "Show"} details`}
      >
        <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden />
        <span>
          Compliance: <span className={meta.tone}>{data.label}</span> · {meta.name}
        </span>
        {d.needs_human_review && (
          <UserCheck className="size-3.5 text-amber-600 dark:text-amber-400" aria-label="Sent for human review" />
        )}
        <ChevronDown className={cn("size-3.5 transition-transform", isOpen ? "rotate-180" : "rotate-0")} />
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 data-[state=closed]:animate-out data-[state=open]:animate-in">
        <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <div className="flex items-start gap-2 border-b border-border/60 pb-2">
            <Icon className={cn("mt-0.5 size-4 shrink-0", meta.tone)} />
            <div className="text-xs">
              <div className={cn("font-medium", meta.tone)}>
                {data.label} · {meta.name}
              </div>
              <div className="text-muted-foreground">{meta.meaning}</div>
            </div>
          </div>

          <dl className="divide-y divide-border/40">
            <Row label="Action">{ACTIONS[d.action_taken] ?? human(d.action_taken)}</Row>
            <Row label="Query type">{human(d.query_type)}</Row>
            <Row label="How it was labelled">
              Model <LabelText label={d.model_label} /> · Code check <LabelText label={d.code_label} /> · Question{" "}
              <LabelText label={d.input_floor} />
              <div className="text-muted-foreground">The strictest of the three is the final label.</div>
            </Row>

            {d.rubric_hits.length > 0 && (
              <Row label="Rubric hits">
                <ul className="space-y-0.5">
                  {d.rubric_hits.map((q) => (
                    <li key={q}>
                      <span className="font-medium">{q}</span> {RUBRIC[q] ? `– ${RUBRIC[q]}` : ""}
                    </li>
                  ))}
                </ul>
              </Row>
            )}

            {d.rules_triggered.length > 0 && (
              <Row label="Rules">
                {d.rules_triggered.map((r) => (
                  <Chip key={r} title={RULES[r]}>
                    {r}
                    {RULES[r] ? `: ${RULES[r]}` : ""}
                  </Chip>
                ))}
              </Row>
            )}

            {d.input_flags.length > 0 && (
              <Row label="Question flags">
                {d.input_flags.map((f) => (
                  <Chip key={f}>{FLAGS[f] ?? human(f)}</Chip>
                ))}
              </Row>
            )}

            {d.pii_types.length > 0 && (
              <Row label="Personal data">
                Detected and masked: {d.pii_types.map((t) => PII_NAMES[t] ?? human(t)).join(", ")}
              </Row>
            )}

            <Row label="Consent">{human(d.consent)}</Row>

            <Row label="Sources">
              {d.sources_used.length === 0 ? (
                <span className="text-muted-foreground">None reported</span>
              ) : (
                <ul className="space-y-0.5">
                  {d.sources_used.map((s, i) => (
                    <li key={`${s.id}-${i}`}>
                      <span className="font-medium">{s.id}</span>
                      {s.detail ? ` – ${s.detail}` : ""}
                      {s.data_date ? ` (data as of ${s.data_date})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </Row>

            <Row label="Gaps">
              {gaps.length === 0 ? (
                <span className="text-muted-foreground">None</span>
              ) : (
                <ul className="space-y-1">
                  {gaps.map(([k, v]) => (
                    <li key={k}>
                      <span className="font-medium">{GAP_NAMES[k] ?? human(k)}:</span> {v.join("; ")}
                    </li>
                  ))}
                </ul>
              )}
            </Row>

            <Row label="Human review">
              {d.needs_human_review ? (
                <>
                  <span className="font-medium text-amber-700 dark:text-amber-400">Queued for review</span>
                  {d.review_reasons.length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      – {d.review_reasons.map((r) => REVIEW_REASONS[r] ?? human(r)).join(", ")}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Not needed</span>
              )}
            </Row>

            <Row label="Confidence">{d.confidence}</Row>
            {d.rationale && <Row label="Rationale">{d.rationale}</Row>}
            {d.disclaimer_appended && <Row label="Disclaimer">Added by the app (the answer was missing it)</Row>}
          </dl>

          <div className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            Governance skill v{d.skill_version} · rules v{d.rules_version}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
