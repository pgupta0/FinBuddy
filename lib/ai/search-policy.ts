import { checkInput } from "@/lib/governance/checks";
export function searchPolicyFor(text: string) {
  const noWeb = /\b(?:do not|don't|don’t|no|without)\s+(?:(?:use|do|browse|search)\s+)?(?:the\s+)?(?:web|online|internet|search)\b/i.test(text);
  const flags = checkInput(text).flags;
  const blockedIntent = flags.includes("recent_data_request") || flags.includes("vulnerable_user") || flags.includes("bypass_attempt");
  const staticConcept = /\b(?:current account|current liabilities|current assets|present value)\b/i.test(text);
  const requestedWeb = /\b(latest|recent|today|yesterday|current|new rules|updates?|news|search (?:online|the web)|look (?:it |this )?up|official (?:source|link)|web search)\b/i.test(text);
  const allowWebSearch = !noWeb && !blockedIntent && requestedWeb && (!staticConcept || /\b(latest|news|new rules|search online|web search)\b/i.test(text));
  return { allowWebSearch, kbLimit: allowWebSearch ? 2 : 1, webLimit: 1 };
}
/** Request-scoped counters, incremented before awaiting external work. */
export function limitSearchCalls<A extends unknown[]>(execute: (...args: A) => PromiseLike<string> | string | AsyncIterable<string>, limit: number): (...args: A) => PromiseLike<string> | string | AsyncIterable<string> {
  let calls = 0;
  const budget = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return (...args: A) => {
    if (calls >= budget) return "<search-budget-exhausted>Use existing evidence. If it is insufficient, state the missing information; do not invent facts or sources.</search-budget-exhausted>";
    calls++;
    return execute(...args);
  };
}
