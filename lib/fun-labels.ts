/**
 * Rotating status labels shown while each phase of the pipeline runs.
 * Each category maps to a phase; see components/ai-elements/ for the renderers.
 */

export const FUN_LABELS = {
  thinking: [
    "Deliberating",
    "Thinking",
    "Pondering",
    "Brainstorming",
    "Contemplating",
    "Reasoning",
  ],
  processing: [
    "Distilling",
    "Synthesizing",
    "Aggregating",
    "Extrapolating",
    "Understanding",
    "Scrutinizing",
    "Triangulating",
    "Correlating",
    "Transforming",
    "Extracting",
    "Filtering",
  ],
  knowledgeBase: [
    "Retrieving",
    "Querying",
    "Accessing",
    "Fetching",
  ],
  webSearch: [
    "Searching",
    "Investigating",
    "Crawling",
    "Browsing",
    "Collecting",
  ],
  assembling: [
    "Composing",
    "Constructing",
    "Organizing",
    "Synthesizing",
    "Integrating",
    "Structuring",
    "Formulating",
    "Finalizing",
  ],
  compacting: [
    "Archiving previous discussion",
    "Summarizing conversation",
    "Reflecting on our discussion",
    "Extracting key insights from conversation",
  ],
  riskQuiz: [
    "Preparing your risk quiz",
    "Shuffling your questions",
    "Setting up your quiz",
  ],
  riskScoring: [
    "Calculating your risk profile",
    "Crunching your answers",
    "Scoring your responses",
  ],
  fundLookup: [
    "Comparing fund houses",
    "Looking up matching funds",
    "Pulling real fund data",
  ],
} as const;

export type FunLabelCategory = keyof typeof FUN_LABELS;

/** Pick a random label from a category, optionally excluding a specific one. */
export function pickRandom(
  category: FunLabelCategory,
  exclude?: string
): string {
  const labels = FUN_LABELS[category];
  const candidates = exclude
    ? labels.filter((l) => l !== exclude)
    : [...labels];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Past-tense completions for result labels.
 * Maps the in-progress label to a suitable past-tense version.
 */
export const PAST_TENSE: Record<FunLabelCategory, string[]> = {
  thinking: [
    "Deliberated",
    "Thought",
    "Pondered",
    "Brainstormed",
    "Contemplated",
    "Reasoned",
  ],
  processing: [
    "Distilled information",
    "Synthesized knowledge",
    "Aggregated data",
    "Connected concepts",
    "Extrapolated findings",
    "Understood the bigger picture",
    "Scrutinized the information",
    "Triangulated results",
    "Correlated findings",
    "Transformed data",
    "Extracted insights",
    "Filtered information"

  ],
  knowledgeBase: [
    "Retrieved knowledge",
    "Queried archives",
    "Accessed knowledge",
    "Searched archives",
    "Fetched documents",
    "Searched memory",
    "Retrieved insights",
  ],
  webSearch: [
    "Searched the web",
    "Investigated online",
    "Crawled websites",
    "Browsed the internet",
    "Collected contemporary data",
  ],
  assembling: [
    "Composed an answer",
    "Constructed a response",
    "Organized thoughts",
    "Synthesized all information",
    "Integrated insights",
    "Structured a response",
    "Formulated an answer",
    "Finalized your answer",
  ],
  compacting: [
    "Archived conversation",
    "Summarized discussion",
    "Extracted key insights from conversation",
    "Reflected on discussion",
  ],
  riskQuiz: [
    "Prepared your risk quiz",
    "Shuffled your questions",
    "Set up your quiz",
  ],
  riskScoring: [
    "Calculated your risk profile",
    "Crunched your answers",
    "Scored your responses",
  ],
  fundLookup: [
    "Compared fund houses",
    "Looked up matching funds",
    "Pulled real fund data",
  ],
};

export function pickRandomPastTense(category: FunLabelCategory): string {
  const labels = PAST_TENSE[category];
  return labels[Math.floor(Math.random() * labels.length)];
}
