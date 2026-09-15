/**
 * Content moderation with configurable provider (env var MODERATION_PROVIDER):
 * - "llm":    LLM classifier running on the utility model (UTILITY_VENDOR/UTILITY_MODEL_ID
 *             in config.ts — works with any vendor; "anthropic" is a legacy alias)
 * - "openai": OpenAI's dedicated moderation API (omni-moderation-latest)
 * - "off":    no moderation call; system prompt guardrails only
 *
 * All providers share the same category taxonomy so the per-category
 * denial messages in config.ts apply regardless of provider.
 */

import OpenAI from 'openai';
import { generateText } from 'ai';
import { getUtilityModel, utilityProviderOptions } from '@/lib/ai/model-registry';
import {
    MODERATION_PROVIDER,
    MODERATION_DENIAL_MESSAGE_SEXUAL,
    MODERATION_DENIAL_MESSAGE_SEXUAL_MINORS,
    MODERATION_DENIAL_MESSAGE_HARASSMENT,
    MODERATION_DENIAL_MESSAGE_HARASSMENT_THREATENING,
    MODERATION_DENIAL_MESSAGE_HATE,
    MODERATION_DENIAL_MESSAGE_HATE_THREATENING,
    MODERATION_DENIAL_MESSAGE_ILLICIT,
    MODERATION_DENIAL_MESSAGE_ILLICIT_VIOLENT,
    MODERATION_DENIAL_MESSAGE_SELF_HARM,
    MODERATION_DENIAL_MESSAGE_SELF_HARM_INTENT,
    MODERATION_DENIAL_MESSAGE_SELF_HARM_INSTRUCTIONS,
    MODERATION_DENIAL_MESSAGE_VIOLENCE,
    MODERATION_DENIAL_MESSAGE_VIOLENCE_GRAPHIC,
    MODERATION_DENIAL_MESSAGE_DEFAULT,
} from '@/config';

export interface ModerationResult {
    flagged: boolean;
    skipped?: boolean;
    denialMessage?: string;
    category?: string;
    /**
     * Why moderation was skipped, when it was. "rate_limited" gets a distinct,
     * actionable message in app/api/chat/route.ts (the free-tier Gemini quota
     * is the far more common cause of a moderation failure than the classifier
     * actually being broken — see the 2026-09-15 QA pass notes). "error" covers
     * everything else (bad response shape, network failure, provider outage).
     */
    skipReason?: "rate_limited" | "error";
}

// Matches the error shapes providers actually throw for "you've used up your
// quota/rate limit" — Gemini's 429 RESOURCE_EXHAUSTED, generic HTTP 429s, and
// OpenAI/Anthropic's "rate_limit" error codes. Deliberately loose (message
// text varies by SDK version) rather than trying to match one provider's exact
// wording.
const RATE_LIMIT_PATTERN = /\b429\b|rate.?limit|resource_exhausted|quota/i;

function isRateLimitError(error: unknown): boolean {
    const message =
        error instanceof Error
            ? `${error.message} ${(error as { cause?: unknown }).cause ?? ""}`
            : String(error);
    return RATE_LIMIT_PATTERN.test(message);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const CATEGORY_DENIAL_MESSAGES: Record<string, string> = {
    'sexual': MODERATION_DENIAL_MESSAGE_SEXUAL,
    'sexual/minors': MODERATION_DENIAL_MESSAGE_SEXUAL_MINORS,
    'harassment': MODERATION_DENIAL_MESSAGE_HARASSMENT,
    'harassment/threatening': MODERATION_DENIAL_MESSAGE_HARASSMENT_THREATENING,
    'hate': MODERATION_DENIAL_MESSAGE_HATE,
    'hate/threatening': MODERATION_DENIAL_MESSAGE_HATE_THREATENING,
    'illicit': MODERATION_DENIAL_MESSAGE_ILLICIT,
    'illicit/violent': MODERATION_DENIAL_MESSAGE_ILLICIT_VIOLENT,
    'self-harm': MODERATION_DENIAL_MESSAGE_SELF_HARM,
    'self-harm/intent': MODERATION_DENIAL_MESSAGE_SELF_HARM_INTENT,
    'self-harm/instructions': MODERATION_DENIAL_MESSAGE_SELF_HARM_INSTRUCTIONS,
    'violence': MODERATION_DENIAL_MESSAGE_VIOLENCE,
    'violence/graphic': MODERATION_DENIAL_MESSAGE_VIOLENCE_GRAPHIC,
};

// Most severe categories first — the first match determines the denial message
const CATEGORY_CHECK_ORDER: string[] = [
    'sexual/minors',
    'sexual',
    'harassment/threatening',
    'harassment',
    'hate/threatening',
    'hate',
    'illicit/violent',
    'illicit',
    'self-harm/instructions',
    'self-harm/intent',
    'self-harm',
    'violence/graphic',
    'violence',
];

function resultForCategory(category: string): ModerationResult {
    return {
        flagged: true,
        category,
        denialMessage: CATEGORY_DENIAL_MESSAGES[category] || MODERATION_DENIAL_MESSAGE_DEFAULT,
    };
}

// --- OpenAI moderation API ---

async function moderateWithOpenAI(text: string): Promise<ModerationResult> {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        organization: null,
        project: null,
    });

    const moderationResult = await openai.moderations.create({ input: text });
    const result = moderationResult.results[0];
    if (!result?.flagged) {
        return { flagged: false };
    }

    const categories = result.categories;
    for (const category of CATEGORY_CHECK_ORDER) {
        if (categories[category as keyof typeof categories] === true) {
            return resultForCategory(category);
        }
    }
    return { flagged: true, denialMessage: MODERATION_DENIAL_MESSAGE_DEFAULT };
}

// --- Anthropic (Claude) classifier ---

const LLM_MODERATION_SYSTEM =
    'You are a strict content-safety classifier. Classify the user message into exactly one category.\n' +
    'Categories (use exactly these strings):\n' +
    CATEGORY_CHECK_ORDER.map((c) => `- ${c}`).join('\n') +
    '\n- safe\n\n' +
    'Rules:\n' +
    '- "safe" means the message contains NONE of the harmful categories.\n' +
    '- Academic discussion, critique, and research questions are safe.\n' +
    '- Only flag content that genuinely requests, promotes, or graphically depicts harm.\n' +
    '- Respond with ONLY a JSON object: {"category": "<category>"} — no other text.';

async function moderateWithLLM(text: string): Promise<ModerationResult> {
    const result = await generateText({
        model: getUtilityModel(),
        system: LLM_MODERATION_SYSTEM,
        prompt: text,
        providerOptions: utilityProviderOptions(),
    });

    // Robust extraction: find the {"category": ...} object even if the model
    // wrapped it in code fences or added surrounding text.
    const raw = result.text.trim();
    const match = raw.match(/\{[^{}]*"category"[^{}]*\}/);
    if (!match) {
        // No parseable classification — treat as provider error so
        // MODERATION_FAIL_POLICY decides (throw is caught by caller).
        throw new Error(`Unparseable moderation response: ${raw.slice(0, 200)}`);
    }

    const parsed = JSON.parse(match[0]);
    const category = String(parsed.category ?? '').trim().toLowerCase();

    if (!category || category === 'safe') {
        return { flagged: false };
    }
    if (CATEGORY_DENIAL_MESSAGES[category]) {
        return resultForCategory(category);
    }
    // Unknown category label from the model — treat as flagged with default message
    return { flagged: true, denialMessage: MODERATION_DENIAL_MESSAGE_DEFAULT };
}

// --- Public API ---

export async function isContentFlagged(text: string): Promise<ModerationResult> {
    if (!text || text.trim().length === 0) {
        return { flagged: false };
    }

    if (MODERATION_PROVIDER === 'off') {
        return { flagged: false };
    }

    const run = () =>
        MODERATION_PROVIDER === 'llm' ? moderateWithLLM(text) : moderateWithOpenAI(text);

    try {
        return await run();
    } catch (firstError) {
        // One short retry — this only helps a transient per-minute rate limit
        // or a momentary network blip. It does nothing for a per-day quota
        // that's actually exhausted (the retry fails the same way, ~600ms
        // later), which is fine: that case is handled below by returning a
        // distinct skipReason instead of pretending a retry could fix it.
        if (isRateLimitError(firstError)) {
            await sleep(600);
            try {
                return await run();
            } catch (secondError) {
                console.error(`Moderation rate-limited (provider: ${MODERATION_PROVIDER}):`, secondError);
                return { flagged: false, skipped: true, skipReason: "rate_limited" };
            }
        }
        console.error(`Moderation error (provider: ${MODERATION_PROVIDER}):`, firstError);
        // skipped=true lets MODERATION_FAIL_POLICY decide whether to block
        return { flagged: false, skipped: true, skipReason: "error" };
    }
}
