// Focused beginner journeys grounded in the existing knowledge base.
import { BookOpen, Repeat2, LayoutGrid, ShieldCheck, BadgeIndianRupee, ClipboardList, type LucideIcon } from "lucide-react";
export type StarterPrompt = { id: string; label: string; hint: string; prompt: string; icon: LucideIcon; };
export const STARTER_PROMPTS: StarterPrompt[] = [
  { id: "investing-basics", label: "I’m new to investing", hint: "Learn the basics first",
    prompt: "I'm new to investing in India. Briefly explain saving versus investing, why investments can lose value, and one basic concept I can learn next. Please use plain language and do not recommend products.", icon: BookOpen },
  { id: "understand-sip", label: "How does a SIP work?", hint: "Understand regular investing",
    prompt: "What is a SIP and how does it work? Explain briefly with one clearly hypothetical example, and explain that regular investing does not guarantee returns. Do not recommend a scheme.", icon: Repeat2 },
  { id: "investment-types", label: "Explore investment types", hint: "Equity, debt, gold and cash",
    prompt: "Explain equity, debt, gold and cash in a short comparison of risk and liquidity. Define each in simple language without telling me where to invest.", icon: LayoutGrid },
  { id: "understand-risk", label: "What does risk mean?", hint: "Understand losses and ups and downs",
    prompt: "Explain investment risk, volatility and diversification in plain language. Give one simple educational example and explain that diversification cannot prevent every loss. Keep it brief.", icon: ShieldCheck },
  { id: "fund-costs", label: "Understand fund costs", hint: "Fees and direct vs regular plans",
    prompt: "What is a mutual fund expense ratio, and how do direct and regular plans differ? Explain the costs briefly in plain language, without recommending a fund or plan.", icon: BadgeIndianRupee },
  { id: "risk-assessment", label: "Try the risk quiz", hint: "Explore risk in five questions",
    prompt: "Please start the fixed five-question risk assessment quiz. Explain that it is an educational illustration, not a validated personalized investment recommendation.", icon: ClipboardList },
];
