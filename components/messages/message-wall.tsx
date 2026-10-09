import { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";
import type { AddRiskQuizOutput } from "./risk-quiz-widget";

// How close to the bottom (in pixels) still counts as "at the bottom" and
// should keep auto-following new content. Streaming updates the `messages`
// array many times a second (see experimental_throttle in app/page.tsx), so
// unconditionally calling scrollIntoView on every change — the previous
// behavior — re-triggered a smooth-scroll animation dozens of times a
// second. That both looked janky and fought the user's own scrolling
// whenever they scrolled up mid-stream to reread something. Now we only
// auto-scroll when the user hasn't deliberately scrolled away from the
// bottom, and use an instant jump (not an animated one) while streaming.
const NEAR_BOTTOM_THRESHOLD_PX = 120;

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
    let node = el?.parentElement ?? null;
    while (node) {
        const { overflowY } = getComputedStyle(node);
        if (overflowY === "auto" || overflowY === "scroll") return node;
        node = node.parentElement;
    }
    return null;
}

export function MessageWall({ messages, status, durations, onDurationChange, conversationId, addToolOutput, onRegenerate, onEditMessage }: { messages: UIMessage[]; status?: string; durations?: Record<string, number>; onDurationChange?: (key: string, duration: number) => void; conversationId?: string; addToolOutput?: AddRiskQuizOutput; onRegenerate?: (messageId: string) => void; onEditMessage?: (messageId: string, newText: string) => void }) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    // The scrollable ancestor is a stable layout element (the page's chat
    // pane), so it's cached after the first lookup instead of re-walking the
    // DOM on every message update.
    const scrollParentRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!scrollParentRef.current) {
            scrollParentRef.current = findScrollParent(messagesEndRef.current);
        }
        const container = scrollParentRef.current;

        if (container) {
            const distanceFromBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight;
            if (distanceFromBottom > NEAR_BOTTOM_THRESHOLD_PX) return;
        }

        messagesEndRef.current?.scrollIntoView({
            behavior: status === "streaming" ? "auto" : "smooth",
        });
    }, [messages, status]);

    return (
        <div className="relative max-w-3xl w-full">
            <div className="relative flex flex-col gap-6">
                {messages.map((message, messageIndex) => {
                    const isLastMessage = messageIndex === messages.length - 1;
                    // Regenerate only makes sense on the most recent assistant
                    // turn, and only once the previous request has settled —
                    // otherwise it could fire against a message that's still
                    // mid-stream or about to be replaced.
                    const canRegenerate = isLastMessage && status === "ready" && !!onRegenerate;
                    return (
                        <div key={message.id} className="w-full">
                            {message.role === "user" ? (
                                <UserMessage
                                    message={message}
                                    onEdit={onEditMessage}
                                    disabled={status !== "ready"}
                                />
                            ) : (
                                <AssistantMessage
                                    message={message}
                                    status={status}
                                    isLastMessage={isLastMessage}
                                    durations={durations}
                                    onDurationChange={onDurationChange}
                                    conversationId={conversationId}
                                    addToolOutput={addToolOutput}
                                    onRegenerate={canRegenerate ? () => onRegenerate!(message.id) : undefined}
                                />
                            )}
                        </div>
                    );
                })}

                <div ref={messagesEndRef} />
            </div>
        </div>
    );
}