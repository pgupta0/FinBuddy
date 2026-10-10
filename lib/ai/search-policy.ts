export function searchPolicyFor(text: string) {
  const noWeb = /\b(?:do not|don't|no|without) (?:use |do )?(?:web|online|internet|search)/i.test(text);
  const requestedWeb = /\b(latest|recent|today|yesterday|current|new rules|updates?|news|search (?:online|the web)|look (?:it |this )?up|official (?:source|link)|web search)\b/i.test(text);
  return { allowWebSearch: !noWeb && requestedWeb, kbLimit: !noWeb && requestedWeb ? 2 : 1, webLimit: 1 };
}
/** Request-scoped counters, incremented before awaiting external work. */
export function limitSearchCalls<A extends unknown[]>(execute: (...args: A) => PromiseLike<string> | string | AsyncIterable<string>, limit: number): (...args: A) => PromiseLike<string> | string | AsyncIterable<string> {
  let calls = 0;
  return (...args: A) => {
    if (calls >= limit) return "<search-budget-exhausted>Use existing evidence. If it is insufficient, state the missing information; do not invent facts or sources.</search-budget-exhausted>";
    calls++;
    return execute(...args);
  };
}
