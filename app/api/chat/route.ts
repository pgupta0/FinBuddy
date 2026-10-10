import {
  streamText,
  UIMessage,
  type TextUIPart,
  type ModelMessage,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { ensureEnv } from "@/lib/env";
import { SYSTEM_PROMPT } from "@/prompts";
import { outputTokenLimit } from "@/lib/ai/output-budget";
import { isContentFlagged, type ModerationResult } from "@/lib/moderation";
import {
  MODERATION_FAIL_POLICY,
  MAX_MESSAGES,
  MAX_MESSAGE_TEXT_LENGTH,
  MAX_OUTPUT_TOKENS,
  COMPACTION_MAX_SUMMARY_CHARS,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_FILE_SIZE_MB,
  ENABLE_VECTOR_SEARCH,
  PROMPT_CACHING_ENABLED,
  PROMPT_CACHE_TTL,
  COMPLIANCE_VIEW_ENABLED,
} from "@/config";
import { mentionsKbTerm } from "@/lib/ai/kb-keywords";
import { signSummary, verifySummary } from "@/lib/summary-signature";
import { getModel, promptCacheOptions } from "@/lib/ai/model-registry";
import {
  routeRequest,
  getLatestUserText,
  buildProviderOptions,
  providerOptionsForForcedTool,
} from "@/lib/ai/routing";
import { buildToolSet, buildToolGuidance } from "@/lib/ai/tools";
import { compactMessages } from "@/lib/compaction";
import {
  normUrl,
  rewriteCitations,
  hostnameOf,
  quoteAppearsIn,
  claimSupported,
} from "@/lib/citations";
import { uiSourceSchema, type UISource } from "@/types/data";
import { checkInput, countAdviceRequests, maskPII } from "@/lib/governance/checks";
import { evaluateTurn, toClientData } from "@/lib/governance/reconcile";
import { stripComplianceBlocks } from "@/lib/governance/compliance-block";
import { buildAuditEntry, writeAuditEntry } from "@/lib/governance/audit-log";
import { buildGovernanceTurnNote } from "@/lib/governance/turn-note";

// Next.js requires segment config to be a static literal (not imported).
// Keep in sync with VERCEL_MAX_DURATION in config.ts and Vercel Pro plan settings.
export const maxDuration = 120;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// Base64 inflates a file's size by roughly a third (4/3), so this bounds a
// data-URL part's decoded byte length without actually decoding it.
const MAX_ATTACHMENT_DATA_URL_LENGTH = Math.ceil(
  (MAX_ATTACHMENT_FILE_SIZE_MB * 1024 * 1024 * 4) / 3
) + 256; // + slack for the "data:<mime>;base64," prefix

function validateLatestUserAttachments(messages: UIMessage[]): string | null {
  const latestUserMessage = messages.filter((m) => m.role === "user").pop();
  if (!latestUserMessage) return null;

  const fileParts = latestUserMessage.parts.filter(
    (p: any) => p.type === "file"
  ) as any[];

  if (fileParts.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return `Too many attachments (max ${MAX_ATTACHMENTS_PER_MESSAGE} per message).`;
  }

  for (const part of fileParts) {
    const url: string = part.url ?? "";
    if (url.startsWith("data:") && url.length > MAX_ATTACHMENT_DATA_URL_LENGTH) {
      return `Attachment "${part.filename ?? "file"}" is too large (max ${MAX_ATTACHMENT_FILE_SIZE_MB}MB).`;
    }
  }

  return null;
}


/** Text of every user message in the conversation, oldest first. */
function allUserTexts(messages: UIMessage[]): string[] {
  return messages
    .filter((m) => m.role === "user")
    .map((m) =>
      (m.parts ?? [])
        .filter((p): p is TextUIPart => p.type === "text")
        .map((p) => p.text)
        .join("\n")
    );
}

/**
 * Governance skill Section 6 I-2 / Section 9.2 (data minimisation): personal
 * identifiers in user text are replaced with typed placeholders before the
 * conversation reaches the model, moderation or compaction. The browser still
 * holds what the user typed; nothing downstream of this point does.
 */
function maskUserMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) =>
    m.role !== "user"
      ? m
      : {
          ...m,
          parts: (m.parts ?? []).map((p) =>
            p.type === "text" ? { ...p, text: maskPII(p.text) } : p
          ),
        }
  );
}

function createPlainTextResponse(message: string) {
  const stream = createUIMessageStream({
    execute({ writer }) {
      const textId = "server-message";
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: message });
      writer.write({ type: "text-end", id: textId });
      // Static server-authored moderation refusals contain no model draft.
      writer.write({ type: "data-compliance", data: { label: "GREEN", withheld: false, appendDisclaimer: false } });
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  // Validated here, at request time, rather than at module import time — see
  // the comment on ensureEnv() in lib/env.ts for why that distinction matters.
  try {
    ensureEnv();
  } catch {
    return jsonError(
      "Server misconfiguration: required environment variables are missing. Check the server logs for details.",
      500
    );
  }

  // --- Parse and validate request body ---
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON in request body.", 400);
  }

  const rawMessages: UIMessage[] = body.messages ?? [];

  // Read compaction summary from request headers (client sends via headers, not body).
  // The summary enters the model context as trusted history, so it is only
  // accepted with a valid server-issued HMAC (X-Compacted-Signature) and
  // within the server's own size cap. Anything else is ignored and the
  // server recompacts from the full message history.
  const summaryB64 = req.headers.get("X-Compacted-Summary");
  const upToStr = req.headers.get("X-Compacted-UpTo");
  const summarySignature = req.headers.get("X-Compacted-Signature");
  let storedSummary: string | undefined;
  let summarizedUpTo: number | undefined;
  if (summaryB64 && upToStr) {
    try {
      const summary = decodeURIComponent(escape(atob(summaryB64)));
      const upTo = parseInt(upToStr, 10);
      if (
        summary.length <= COMPACTION_MAX_SUMMARY_CHARS &&
        Number.isInteger(upTo) &&
        upTo >= 0 &&
        verifySummary(summary, upTo, summarySignature)
      ) {
        storedSummary = summary;
        summarizedUpTo = upTo;
      } else if (process.env.NODE_ENV === "development") {
        console.warn("COMPACTION: rejected client summary (bad signature or size)");
      }
    } catch {
      // Invalid base64 — ignore
    }
  }
  // Read feedback ratings from client
  let feedback: Record<string, "up" | "down"> | undefined;
  const feedbackB64 = req.headers.get("X-Feedback");
  if (feedbackB64) {
    try { feedback = JSON.parse(atob(feedbackB64)); } catch { /* ignore */ }
  }
  if (process.env.NODE_ENV === "development") {
    console.log(`COMPACTION SERVER: storedSummary: ${storedSummary ? storedSummary.length + ' chars' : 'none'}, summarizedUpTo: ${summarizedUpTo ?? 'none'}, feedback: ${feedback ? Object.keys(feedback).length + ' ratings' : 'none'}`);
  }

  if (!Array.isArray(rawMessages)) {
    return jsonError("'messages' must be an array.", 400);
  }

  if (rawMessages.length > MAX_MESSAGES) {
    return jsonError(
      `Too many messages (max ${MAX_MESSAGES}). Please start a new conversation.`,
      400
    );
  }

  if (getLatestUserText(rawMessages).length > MAX_MESSAGE_TEXT_LENGTH) {
    return jsonError(
      `Message too long (max ${MAX_MESSAGE_TEXT_LENGTH} characters).`,
      400
    );
  }

  // Defense in depth: the client (lib/attachments.ts) already enforces file
  // count and size, but a request can bypass the browser entirely.
  const attachmentError = validateLatestUserAttachments(rawMessages);
  if (attachmentError) {
    return jsonError(attachmentError, 400);
  }

  // --- Governance input checks (skill Section 6) ---
  // Run on the RAW latest message so PII is detected before it is masked;
  // everything after this point sees only the masked conversation.
  const rawLatestText = getLatestUserText(rawMessages);
  const governanceInput = checkInput(rawLatestText);
  const adviceRequestCount = countAdviceRequests(allUserTexts(rawMessages));
  const governanceTurnNote = buildGovernanceTurnNote(governanceInput, adviceRequestCount);
  const messages = maskUserMessages(rawMessages);
  const sessionId = String(rawMessages[0]?.id ?? "unknown");
  const latestText = getLatestUserText(messages);

  // --- Route request ---
  // The header picker sends its choice here. Both values are UNTRUSTED —
  // routeRequest validates them against the catalog and the keys that are
  // actually set, and falls back to the configured default if either is off.
  // Sent as headers rather than in the body so this rides alongside the
  // existing X-Compacted-* headers and needs no change to the message payload.
  const requestedModel = {
    vendor: req.headers.get("X-Model-Vendor"),
    modelId: req.headers.get("X-Model-Id"),
  };

  const { vendor, modelId, mode, thinkingLevel, maxSteps } = routeRequest(messages, requestedModel);
  // Routing logged at debug level only
  if (process.env.NODE_ENV === "development") {
    console.debug("AI ROUTING:", { vendor, modelId, mode, thinkingLevel, maxSteps, requestedModel });
  }

  // --- Build model, tools, and provider options ---
  // Request-scoped collector: the search tools push structured sources here, so
  // the client can render a deterministic Sources box (a `data-sources` stream
  // part) independent of the model's markdown. Deduped by url (or title if none).
  const collectedSources: UISource[] = [];
  const seenSourceKeys = new Set<string>();
  // Retrieved text per source URL/key, for verifying citation claims.
  const contentByUrl = new Map<string, string>();
  const collectSource = (s: UISource, content?: string) => {
    // Dedup by URL across kinds (one URL must never appear twice in the panel);
    // sources without a URL dedup by kind+title.
    const key = s.url ? s.url.toLowerCase() : `${s.kind}|${s.title}`;
    if (content && s.url) {
      const norm = normUrl(s.url);
      contentByUrl.set(norm, (contentByUrl.get(norm) || "") + "\n" + content);
    }
    if (seenSourceKeys.has(key)) return;
    seenSourceKeys.add(key);
    collectedSources.push(s);
  };

  // Sources from earlier turns' Sources boxes (data-sources parts in the
  // incoming history). In follow-up turns the model legitimately cites URLs it
  // learned earlier without re-searching; this lookup restores their full
  // titles instead of falling back to a bare hostname. Client-supplied, so
  // each entry is schema-validated before use.
  const priorSourcesByUrl = new Map<string, UISource>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts ?? []) {
      const p = part as { type?: string; data?: unknown };
      if (p.type === "data-sources" && Array.isArray(p.data)) {
        for (const raw of p.data) {
          const parsed = uiSourceSchema.safeParse(raw);
          if (parsed.success && parsed.data.url) {
            priorSourcesByUrl.set(normUrl(parsed.data.url), parsed.data);
          }
        }
      }
    }
  }

  const model = getModel(vendor, modelId);
  const tools = buildToolSet(collectSource);
  const toolGuidance = buildToolGuidance();
  const providerOptions = buildProviderOptions(vendor, mode, thinkingLevel, modelId);

  // --- Run moderation + compaction in parallel (saves ~3-5s) ---
  const [moderationResult, compactionResult] = await Promise.all([
    latestText
      ? isContentFlagged(latestText)
      : Promise.resolve<ModerationResult>({ flagged: false, skipped: false, denialMessage: "" }),
    compactMessages(messages, storedSummary, summarizedUpTo, feedback),
  ]);

  // --- Check moderation result ---
  if (moderationResult.flagged) {
    return createPlainTextResponse(
      moderationResult.denialMessage ||
        "Your message violates our guidelines. I can't answer that."
    );
  }
  if (moderationResult.skipped && MODERATION_FAIL_POLICY === "closed") {
    console.warn(
      `Moderation unavailable (${moderationResult.skipReason ?? "error"}); blocking per MODERATION_FAIL_POLICY=closed`
    );
    // A rate limit is not "the safety check is broken" — it's "this model's
    // free-tier quota ran out," which is common on Gemini and has an obvious
    // fix (wait, or switch models). Telling the user that instead of the
    // generic message is the difference between "the bot is dead" and "I know
    // exactly what to do." 429 is also the more accurate status code here than
    // 503 — the server is fine, the request is what's being throttled.
    if (moderationResult.skipReason === "rate_limited") {
      return jsonError(
        "The current model has hit its free-tier rate limit for now. Please wait a minute and try again, or pick a different model from the dropdown in the header.",
        429
      );
    }
    return jsonError("Content moderation is temporarily unavailable. Please try again shortly.", 503);
  }

  // --- Convert messages ---
  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(compactionResult.messages);
  } catch (error) {
    console.error("convertToModelMessages failed:", error);
    return jsonError(
      "Could not process the message format. Please retry or simplify your last message.",
      400
    );
  }

  // --- Stream response ---
  try {
    // The cacheable prefix is SYSTEM_PROMPT + toolGuidance: byte-identical on
    // every request, and together the largest fixed input cost in the app.
    // The compaction note is kept OUT of that prefix so it cannot vary it — a
    // note that appeared and disappeared between turns would invalidate the
    // cache entry every time it changed.
    const systemPrompt = SYSTEM_PROMPT + "\n\n" + toolGuidance;
    const compactionNote = [
      compactionResult.compacted
        ? "[Note: Earlier conversation context is provided as a summary. Continue naturally.]"
        : "",
      governanceTurnNote,
    ]
      .filter(Boolean)
      .join("\n\n");

    // Vendors without explicit caching (OpenAI, Gemini) get `{}` here and cache
    // long prefixes on their own.
    const cacheOptions = PROMPT_CACHING_ENABLED
      ? promptCacheOptions(vendor, PROMPT_CACHE_TTL)
      : {};
    const cacheSystemPrompt = Object.keys(cacheOptions).length > 0;

    // Passed as a leading system MESSAGE rather than streamText's `system`
    // option, because a cache-control marker attaches to a message, not to that
    // option. With no marker the two forms are equivalent.
    const systemMessages: ModelMessage[] = cacheSystemPrompt
      ? [
          {
            role: "system",
            content: systemPrompt,
            providerOptions: cacheOptions,
          },
          ...(compactionNote
            ? [{ role: "system" as const, content: compactionNote }]
            : []),
        ]
      : [
          {
            role: "system",
            content: compactionNote
              ? systemPrompt + "\n\n" + compactionNote
              : systemPrompt,
          },
        ];

    // Wrap streamText in a UI message stream so we can append a structured
    // `data-sources` part once the model (and all its tool steps) finish.
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        // Deterministic safety net: prompt instructions alone ("always
        // search the KB for in-scope questions") were not reliably followed
        // for plain glossary questions like "what is SIP" — the model would
        // sometimes answer from its own training knowledge, so no source was
        // ever collected and the Sources box stayed empty. When the user's
        // latest message plainly names a real, indexed KB term, force the
        // model's FIRST tool-use step to be a real vectorDatabaseSearch call,
        // the same way scoreRiskProfile/fundRecommendations were made
        // deterministic instead of left to the model's own judgment. Only
        // the first step is forced — later steps are unconstrained so the
        // model can still call other tools or compose its final answer.
        const forceKbSearchFirstStep =
          ENABLE_VECTOR_SEARCH && latestText.length > 0 && mentionsKbTerm(latestText);

        // Some vendors reject a forced tool_choice while extended thinking is
        // enabled — Anthropic returns a hard 400 ("Thinking may not be enabled
        // when tool_choice forces tool use."), which broke every matched
        // request in production. Chat requests have thinking on by default
        // (CHAT_THINKING_LEVEL), so on a forced-KB turn the thinking fragment
        // is dropped for vendors that need it dropped; a plain glossary lookup
        // needs no extended reasoning anyway. WHICH vendors those are is
        // declared in lib/ai/providers.ts, not decided here.
        const effectiveProviderOptions = forceKbSearchFirstStep
          ? providerOptionsForForcedTool(vendor, providerOptions)
          : providerOptions;

        const result = streamText({
          model,
          messages: [...systemMessages, ...modelMessages],
          tools,
          stopWhen: stepCountIs(maxSteps),
          maxOutputTokens: outputTokenLimit(MAX_OUTPUT_TOKENS, effectiveProviderOptions),
          providerOptions: effectiveProviderOptions,
          ...(forceKbSearchFirstStep
            ? {
                prepareStep: ({ stepNumber }: { stepNumber: number }) =>
                  stepNumber === 0
                    ? { toolChoice: { type: "tool" as const, toolName: "vectorDatabaseSearch" as const } }
                    : {},
              }
            : {}),
          onFinish: ({ steps }) => {
            // The Sources box is the single reference list, built FROM the
            // text by the SAME canonicalization the client applies at render
            // time (lib/citations.ts): citations are renumbered sequentially
            // by first appearance, so box numbers are always 1..K with no gaps
            // and always match the inline numbers. Uncited sources never
            // appear; sources without a URL are attributed in prose.
            const answerText = steps.map((s) => s.text).join("\n");
            const { orderedUrls, citations } = rewriteCitations(answerText);
            if (orderedUrls.length === 0 && collectedSources.length > 0) {
              // Sources were retrieved but the model cited none of them in a
              // recognized format — surfaced in logs so it is diagnosable.
              console.warn(
                `CITATIONS: model cited no URLs (${collectedSources.length} sources retrieved)`
              );
            }
            const byUrl = new Map<string, UISource>();
            for (const s of collectedSources) {
              if (s.url) byUrl.set(normUrl(s.url), s);
            }
            // Verification (green check when true): a citation is verified
            // when a quote the model attached matches the retrieved source
            // text, or when the sentence preceding the citation (the claim) is
            // supported by that text via significant-word containment. Both
            // checks are deterministic; when nothing can be checked the state
            // stays undefined (no marker either way).
            const isVerified = (
              url: string,
              quotes: string[],
              claims: string[]
            ): boolean | undefined => {
              const content = contentByUrl.get(normUrl(url));
              if (!content) return undefined;
              if (quotes.some((q) => quoteAppearsIn(q, content))) return true;
              if (claims.some((c) => claimSupported(c, content))) return true;
              return quotes.length > 0 || claims.length > 0 ? false : undefined;
            };

            const citedSources: UISource[] = citations.map(({ url, quotes, claims }, i) => {
              const source = byUrl.get(normUrl(url));
              if (source)
                return { ...source, number: i + 1, verified: isVerified(url, quotes, claims) };
              // Cited from earlier conversation turns: reuse that turn's
              // source entry (full title/kind). No retrieved text this turn,
              // so verification is not possible — no check mark.
              const prior = priorSourcesByUrl.get(normUrl(url));
              if (prior) {
                return {
                  kind: prior.kind,
                  title: prior.title,
                  url: prior.url,
                  site: prior.site,
                  ...(prior.publishedDate ? { publishedDate: prior.publishedDate } : {}),
                  number: i + 1,
                };
              }
              if (url.startsWith("kb:")) {
                // kb: citation whose source was not collected this turn (e.g.
                // model reused a key from earlier context). List it unlinked.
                return {
                  kind: "kb" as const,
                  title: url.slice(3).replace(/-/g, " "),
                  url: "",
                  site: "Knowledge base",
                  number: i + 1,
                };
              }
              // Cited URL that no search retrieved (e.g. a profile URL the
              // model knows from its instructions). Still listed, so the box
              // mirrors the text exactly.
              return {
                kind: "web" as const,
                title: hostnameOf(url) || url,
                url,
                site: "",
                number: i + 1,
              };
            });

            // Retrieved sources the model linked as PLAIN markdown links
            // (rather than numbered citations) are still used sources — list
            // them after the numbered ones so web sources never silently
            // disappear from the box.
            const numberedUrls = new Set(orderedUrls.map((u) => normUrl(u)));
            const lowerAnswer = answerText.toLowerCase();
            for (const s of collectedSources) {
              if (!s.url) continue;
              const norm = normUrl(s.url);
              if (numberedUrls.has(norm)) continue;
              if (lowerAnswer.includes(norm)) {
                // Plain-linked (not a numbered citation): nothing to verify,
                // so no badge either way.
                citedSources.push({ ...s, number: citedSources.length + 1 });
                numberedUrls.add(norm);
              }
            }

            // Hard guarantee: information was retrieved this turn (KB and/or
            // web) but the model cited NONE of it — not as a numbered
            // [[N]](url) citation, not even as a plain markdown link. Rather
            // than silently show an answer with no Sources box (the failure
            // mode logged above), surface every retrieved source anyway,
            // unlinked to a specific sentence. This is a last-resort net, not
            // a replacement for inline citations — the model should still
            // always cite properly — but it ensures retrieved information is
            // never presented with zero source attribution.
            if (citedSources.length === 0 && collectedSources.length > 0) {
              for (const s of collectedSources) {
                citedSources.push({ ...s, number: citedSources.length + 1 });
              }
            }

            if (citedSources.length > 0) {
              writer.write({
                type: "data-sources",
                id: "sources",
                data: citedSources,
              });
            }

            // --- Governance output check, reconciliation and audit (skill Sections 4, 10, 11) ---
            // The model's compliance block is parsed and checked against the
            // deterministic rules; the stricter label wins. The browser gets
            // only what it needs to act (label, withheld, appendDisclaimer);
            // the full record goes to the audit log / review queue.
            const quizExceptionActive = steps.some((s) =>
              s.toolCalls.some(
                (c) => c.toolName === "scoreRiskProfile" || c.toolName === "fundRecommendations"
              )
            );
            const record = evaluateTurn({
              userText: rawLatestText,
              adviceRequestCount,
              answerText,
              quizExceptionActive,
              sourceCount: citedSources.length + collectedSources.length,
            });
            writer.write({
              type: "data-compliance",
              id: "compliance",
              data: toClientData(record, COMPLIANCE_VIEW_ENABLED),
            });
            if (record.withheld) {
              console.warn(
                `GOVERNANCE: withheld a RED draft (${record.code_hits.map((h) => h.id).join(", ")})`
              );
            }
            void writeAuditEntry(
              buildAuditEntry(record, {
                sessionId,
                vendor,
                modelId,
                userText: rawLatestText,
                visibleAnswer: stripComplianceBlocks(answerText),
              })
            );
          },
        });
        writer.merge(result.toUIMessageStream({ sendReasoning: true }));
      },
      onError: (error) => {
        console.error("streamText failed:", error);
        return "The model provider returned an error. Please try again.";
      },
    });

    const response = createUIMessageStreamResponse({ stream });

    // Return updated summary for client to store
    if (compactionResult.newSummary) {
      const newUpTo = compactionResult.newSummarizedUpTo ?? 0;
      const encoded = Buffer.from(compactionResult.newSummary).toString("base64");
      response.headers.set("X-Compacted-Summary", encoded);
      response.headers.set("X-Compacted-UpTo", String(newUpTo));
      // Signature the client must return with this summary (see verify above)
      response.headers.set(
        "X-Compacted-Signature",
        signSummary(compactionResult.newSummary, newUpTo)
      );
      // Expose headers to client-side fetch
      response.headers.set(
        "Access-Control-Expose-Headers",
        "X-Compacted-Summary, X-Compacted-UpTo, X-Compacted-Signature"
      );
    }

    return response;
  } catch (error) {
    console.error("streamText failed:", error);
    return jsonError(
      "The model provider returned an error. Please try again.",
      502
    );
  }
}
