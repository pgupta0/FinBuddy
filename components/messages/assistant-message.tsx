"use client";

import { UIMessage, ToolCallPart, ToolResultPart } from "ai";
import { Response } from "@/components/ai-elements/response";
import { ReasoningPart } from "./reasoning-part";
import { ToolCall, ToolResult } from "./tool-call";
import { Sources } from "./sources";
import { rewriteCitationsInParts } from "@/lib/citations";
import type { UISource } from "@/types/data";
import { AssemblingIndicator } from "../ai-elements/assembling-indicator";
import { ProcessingIndicator } from "../ai-elements/processing-indicator";
import { ThumbsUp, ThumbsDown, Copy, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { memo, useState } from "react";
import { saveFeedback, loadFeedback } from "@/lib/storage";
import { RiskQuizWidget, type AddRiskQuizOutput } from "./risk-quiz-widget";
import { RiskProfileResultCard } from "./risk-profile-result-card";
import type { RiskProfileToolOutput } from "@/app/api/chat/tools/score-risk-profile";
import { FundRecommendationsCard } from "./fund-recommendations-card";
import { ComplianceView } from "./compliance-view";
import type { FundRecommendationsOutput } from "@/app/api/chat/tools/fund-recommendations";
import { stripComplianceBlocks } from "@/lib/governance/compliance-block";
import { STANDARD_DISCLAIMER, WITHHELD_REDIRECT } from "@/lib/governance/constants";
import { getComplianceData, visibleAssistantText } from "@/lib/governance/display";

function FeedbackButtons({ messageId, conversationId }: { messageId: string; conversationId?: string }) {
  const [rating, setRating] = useState<"up" | "down" | null>(() => {
    if (!conversationId) return null;
    const fb = loadFeedback(conversationId);
    return fb[messageId] || null;
  });

  async function submitFeedback(value: "up" | "down") {
    const newRating = rating === value ? null : value;
    setRating(newRating);
    if (conversationId && newRating) {
      saveFeedback(conversationId, messageId, newRating);
    }
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, rating: newRating }),
      });
    } catch {
      // Silently fail — feedback is non-critical
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${rating === "up" ? "text-green-600" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => submitFeedback("up")}
        aria-label="Good response"
      >
        <ThumbsUp className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${rating === "down" ? "text-red-600" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => submitFeedback("down")}
        aria-label="Bad response"
      >
        <ThumbsDown className="size-3.5" />
      </Button>
    </div>
  );
}

// Memoized: during streaming, the `messages` array from useChat gets a new
// reference on every chunk, but earlier (non-streaming) messages keep their
// same object identity. Without memo, every AssistantMessage in a
// conversation re-runs its full render — including the citation-rewrite pass
// over every text part — on every single streamed token of the CURRENT
// message, which is pure waste for turns that already finished. Memoizing
// lets React skip all of that for any message whose props haven't actually
// changed. (Relies on callers passing stable callback references — see the
// useCallback around onDurationChange in app/page.tsx; an inline arrow
// function there would defeat this by changing identity every render.)
export const AssistantMessage = memo(function AssistantMessage({
  message,
  status,
  isLastMessage,
  durations,
  onDurationChange,
  conversationId,
  addToolOutput,
  onRegenerate,
}: {
  message: UIMessage;
  status?: string;
  isLastMessage?: boolean;
  durations?: Record<string, number>;
  onDurationChange?: (key: string, duration: number) => void;
  conversationId?: string;
  addToolOutput?: AddRiskQuizOutput;
  onRegenerate?: () => void;
}) {
  const isStreaming = status === "streaming" && isLastMessage;
  // Gates the copy/regenerate/feedback row: hidden while the reply is still
  // streaming, and meaningless on a message with no text (e.g. a bare tool
  // call that hasn't produced a written answer yet).
  const showActions = !isStreaming && message.parts.some((p) => p.type === "text");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = visibleAssistantText(message);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the
      // icon just won't flip to a checkmark; nothing else depends on it.
    }
  }

  // Structured Sources box, rendered from the `data-sources` stream part
  // (independent of the model's markdown). Empty until the response finishes.
  const sourcesPart = message.parts.find((p) => p.type === "data-sources") as
    | { type: "data-sources"; data: UISource[] }
    | undefined;
  // Governance verdict for this turn (skill Sections 4 and 10), sent by the
  // server once the answer is complete. `withheld`: the deterministic checks
  // found advice the model did not redirect, so the draft is replaced by the
  // standard Educational Redirect. `appendDisclaimer`: the answer was
  // substantive but lacked the required disclaimer, so the app adds it.
  const compliance = getComplianceData(message);
  const withheld = compliance?.withheld === true;
  const appendDisclaimer = compliance?.appendDisclaimer === true && !withheld;
  // A withheld draft's citations belong to text the user no longer sees.
  const sources = withheld ? [] : sourcesPart?.data ?? [];

  // Canonicalize citations across ALL text parts with shared numbering state —
  // the same transform the server runs on the joined text to build the Sources
  // box, so inline numbers and box numbers agree by construction.
  const textPartIndexes: number[] = [];
  message.parts.forEach((p, i) => {
    if (p.type === "text") textPartIndexes.push(i);
  });
  // The model ends every answer with a machine-readable ```compliance block
  // (governance skill Section 10); it is never shown to the user.
  const rewrittenTexts = rewriteCitationsInParts(
    textPartIndexes.map((i) => stripComplianceBlocks((message.parts[i] as { text: string }).text))
  );
  const rewrittenByIndex = new Map<number, string>(
    textPartIndexes.map((partIndex, j) => [partIndex, rewrittenTexts[j]])
  );

  // Track which parts come after tool calls
  const hasToolBefore = new Set<number>();
  let seenTool = false;
  for (let i = 0; i < message.parts.length; i++) {
    const p = message.parts[i];
    if (p.type?.startsWith("tool-") || p.type === "dynamic-tool") {
      seenTool = true;
    } else if (seenTool && (p.type === "reasoning" || p.type === "text")) {
      hasToolBefore.add(i);
    }
  }

  // Check if there's any tool or reasoning in the message
  const hasContentBefore = message.parts.some(
    (p) => p.type === "reasoning" || p.type?.startsWith("tool-") || p.type === "dynamic-tool"
  );

  // Find the last text part index
  let lastTextIndex = -1;
  for (let i = message.parts.length - 1; i >= 0; i--) {
    if (message.parts[i].type === "text") {
      lastTextIndex = i;
      break;
    }
  }

  return (
    <div className="w-full">
      <div className="text-sm flex flex-col gap-4">
        {message.parts.map((part, i) => {
          const isPartStreaming =
            isStreaming && i === message.parts.length - 1;
          const durationKey = `${message.id}-${i}`;
          const duration = durations?.[durationKey];

          if (part.type === "text") {
            const isLastText = i === lastTextIndex;
            if (withheld) {
              // Show the safe redirect once, in place of the final answer.
              return isLastText ? (
                <div key={`${message.id}-${i}`}>
                  <Response isAnimating={false}>{WITHHELD_REDIRECT}</Response>
                </div>
              ) : null;
            }
            const isAfterTool = hasToolBefore.has(i);
            // Check if there's already an intermediate text part after tools (processing already shown)
            const hasIntermediateProcessingText = isLastText && seenTool && message.parts.some(
              (p, idx) => idx < i && p.type === "text" && hasToolBefore.has(idx)
            );
            return (
              <div key={`${message.id}-${i}`}>
                {isLastText && isAfterTool && !hasIntermediateProcessingText && (
                  <ProcessingIndicator isStreaming={false} />
                )}
                {isLastText && hasContentBefore && (
                  <AssemblingIndicator isStreaming={isPartStreaming} />
                )}
                {!isLastText && isAfterTool && (
                  <ProcessingIndicator isStreaming={isPartStreaming} />
                )}
                <Response isAnimating={isPartStreaming}>
                  {rewrittenByIndex.get(i) ?? stripComplianceBlocks(part.text)}
                </Response>
                {isLastText && appendDisclaimer && (
                  <p className="mt-3 text-xs italic text-muted-foreground">{STANDARD_DISCLAIMER}</p>
                )}
              </div>
            );
          } else if (part.type === "reasoning") {
            return (
              <ReasoningPart
                key={`${message.id}-${i}`}
                part={part}
                isStreaming={isPartStreaming}
                category={hasToolBefore.has(i) ? "processing" : "thinking"}
                duration={duration}
                onDurationChange={
                  onDurationChange
                    ? (d) => onDurationChange(durationKey, d)
                    : undefined
                }
              />
            );
          } else if (part.type === "tool-presentRiskQuiz") {
            // Client-side tool: no output until the interactive widget
            // resolves it. Once resolved, there's nothing worth redisplaying
            // (the user's clicked answers already led straight into the
            // score/recommendation that follows), so render nothing.
            if ("state" in part && part.state === "output-available") {
              return null;
            }
            const toolCallId =
              "toolCallId" in part ? (part as { toolCallId: string }).toolCallId : `${message.id}-${i}`;
            return (
              <RiskQuizWidget
                key={`${message.id}-${i}`}
                part={{ toolCallId, state: "state" in part ? part.state : undefined }}
                addToolOutput={addToolOutput}
              />
            );
          } else if (part.type === "tool-scoreRiskProfile") {
            if ("state" in part && part.state === "output-available" && "output" in part) {
              return (
                <RiskProfileResultCard
                  key={`${message.id}-${i}`}
                  output={part.output as RiskProfileToolOutput}
                />
              );
            }
            return (
              <ToolCall
                key={`${message.id}-${i}`}
                part={part as unknown as ToolCallPart}
              />
            );
          } else if (part.type === "tool-fundRecommendations") {
            if ("state" in part && part.state === "output-available" && "output" in part) {
              return (
                <FundRecommendationsCard
                  key={`${message.id}-${i}`}
                  output={part.output as FundRecommendationsOutput}
                />
              );
            }
            return (
              <ToolCall
                key={`${message.id}-${i}`}
                part={part as unknown as ToolCallPart}
              />
            );
          } else if (
            part.type.startsWith("tool-") ||
            part.type === "dynamic-tool"
          ) {
            if ("state" in part && part.state === "output-available") {
              return (
                <ToolResult
                  key={`${message.id}-${i}`}
                  part={part as unknown as ToolResultPart}
                />
              );
            } else {
              return (
                <ToolCall
                  key={`${message.id}-${i}`}
                  part={part as unknown as ToolCallPart}
                />
              );
            }
          }
          return null;
        })}
      </div>
      {sources.length > 0 && <Sources sources={sources} />}
      {compliance && !isStreaming && <ComplianceView data={compliance} />}
      {showActions && (
        <div className="flex items-center gap-1 mt-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy response"}
            title={copied ? "Copied" : "Copy response"}
          >
            {copied ? (
              <Check className="size-3.5 text-green-600 dark:text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
          {onRegenerate && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onRegenerate}
              aria-label="Regenerate response"
              title="Regenerate response"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
          <FeedbackButtons messageId={message.id} conversationId={conversationId} />
        </div>
      )}
    </div>
  );
});
