/**
 * Rotating status labels shown while each phase of the pipeline runs.
 * Each category maps to a phase; see components/ai-elements/ for the renderers.
 */

export const FUN_LABELS = {
  thinking: [
    "Weighing the numbers",
    "Sizing up your question",
    "Running the analysis",
    "Studying your situation",
    "Assessing the numbers",
    "Working through the details",
  ],
  processing: [
    "Crunching the numbers",
    "Balancing the figures",
    "Reconciling the data",
    "Cross-checking the figures",
    "Auditing the findings",
    "Stress-testing the numbers",
    "Netting out the details",
    "Tallying the figures",
    "Weighing the evidence",
    "Sifting through the data",
    "Running the calculations",
  ],
  knowledgeBase: [
    "Consulting the playbook",
    "Checking the records",
    "Pulling up the figures",
    "Referencing the archive",
  ],
  webSearch: [
    "Scanning the markets",
    "Checking the news wire",
    "Tracking the headlines",
    "Monitoring market updates",
    "Following the news",
  ],
  assembling: [
    "Drafting your answer",
    "Building the picture",
    "Putting it together",
    "Writing up the analysis",
    "Compiling the report",
    "Summarizing the findings",
    "Finalizing the numbers",
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
    "Weighed the numbers",
    "Sized up your question",
    "Ran the analysis",
    "Studied your situation",
    "Assessed the numbers",
    "Worked through the details",
  ],
  processing: [
    "Crunched the numbers",
    "Balanced the figures",
    "Reconciled the data",
    "Cross-checked the figures",
    "Audited the findings",
    "Stress-tested the numbers",
    "Netted out the details",
    "Tallied the figures",
    "Weighed the evidence",
    "Sifted through the data",
    "Ran the calculations",
  ],
  knowledgeBase: [
    "Consulted the playbook",
    "Checked the records",
    "Pulled up the figures",
    "Referenced the archive",
  ],
  webSearch: [
    "Scanned the markets",
    "Checked the news wire",
    "Tracked the headlines",
    "Monitored market updates",
    "Followed the news",
  ],
  assembling: [
    "Drafted your answer",
    "Built the picture",
    "Put it together",
    "Wrote up the analysis",
    "Compiled the report",
    "Summarized the findings",
    "Finalized the numbers",
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
