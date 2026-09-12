import { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";
import type { AddRiskQuizOutput } from "./risk-quiz-widget";


export function MessageWall({ messages, status, durations, onDurationChange, conversationId, addToolOutput, onRegenerate, onEditMessage }: { messages: UIMessage[]; status?: string; durations?: Record<string, number>; onDurationChange?: (key: string, duration: number) => void; conversationId?: string; addToolOutput?: AddRiskQuizOutput; onRegenerate?: (messageId: string) => void; onEditMessage?: (messageId: string, newText: string) => void }) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (
        <div className="relative max-w-3xl w-full">
            <div className="relative flex flex-col gap-4">
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