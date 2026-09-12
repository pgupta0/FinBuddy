// lib/starter-prompts.ts
//
// The six options shown on the empty-state landing screen
// (app/parts/welcome-hero.tsx). Clicking one sends `prompt` as the user's
// first message — so each prompt must be self-contained and phrased the way a
// real user would ask, not as an instruction to the model.
//
// Every prompt here stays inside KB_SCOPE (config.ts): asset-class-level
// education, the fixed risk-profile quiz, glossary terms, and the three
// strategy frameworks. None of them ask for a specific security to buy or sell.

import {
  BookOpen,
  Compass,
  LayoutGrid,
  Route,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type StarterPrompt = {
  id: string;
  /** Short label on the card — keep to ~3 words so it wraps to two lines. */
  label: string;
  /** One-line clarifier under the label. */
  hint: string;
  /** The text actually sent to /api/chat when the card is clicked. */
  prompt: string;
  icon: LucideIcon;
};

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: "where-to-invest",
    label: "Where do I invest?",
    hint: "Choosing between asset classes",
    prompt:
      "Where should I invest? Explain how a first-time Indian investor should think about splitting money across asset classes — equity, debt, gold and cash — and what actually drives that choice.",
    icon: Compass,
  },
  {
    id: "how-to-invest",
    label: "How do I invest?",
    hint: "The practical first steps",
    prompt:
      "How do I actually start investing in India? Walk me through the practical steps — KYC, a demat account versus a mutual fund account, direct versus regular plans, and setting up a SIP.",
    icon: Route,
  },
  {
    id: "risk-assessment",
    label: "My risk assessment",
    hint: "Find your investor profile",
    prompt:
      "I'd like to work out my risk profile. Please start the risk assessment quiz.",
    icon: ShieldCheck,
  },
  {
    id: "available-investments",
    label: "What's available?",
    hint: "The full menu of options",
    prompt:
      "What kinds of investments are available to a retail investor in India? Give me an overview of the main categories and how they compare on risk, liquidity and taxation.",
    icon: LayoutGrid,
  },
  {
    id: "explain-a-term",
    label: "Explain a term",
    hint: "Jargon in plain English",
    prompt:
      "Explain some common investing terms to me in plain English — start with expense ratio, NAV, and the difference between direct and regular plans, and tell me why each one affects my returns.",
    icon: BookOpen,
  },
  {
    id: "compare-strategies",
    label: "Compare strategies",
    hint: "Risk parity, core-satellite, endowment",
    prompt:
      "Compare the main allocation strategies — risk parity, core-satellite and endowment-style. How do they differ, and what kind of investor is each one usually suited to?",
    icon: Scale,
  },
];
