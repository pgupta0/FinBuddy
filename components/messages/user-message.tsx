"use client";

import { useState } from "react";
import { UIMessage } from "ai";
import { Response } from "@/components/ai-elements/response";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";

function textOf(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n");
}

export function UserMessage({
  message,
  onEdit,
  disabled,
}: {
  message: UIMessage;
  /** Omit to disable editing entirely (e.g. read-only contexts). */
  onEdit?: (messageId: string, newText: string) => void;
  /** True while a request is in flight — editing then would race the stream. */
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(() => textOf(message));

  function startEdit() {
    setDraft(textOf(message));
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  function saveEdit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== textOf(message).trim()) {
      onEdit?.(message.id, trimmed);
    }
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="w-full flex justify-end">
        <div className="w-full max-w-[85%] sm:max-w-lg">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => {
              // Land the cursor at the end rather than selecting everything.
              const len = e.currentTarget.value.length;
              e.currentTarget.setSelectionRange(len, len);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                saveEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
            aria-label="Edit message"
            className="min-h-14 max-h-48 resize-none rounded-[20px] bg-card py-3 px-4 text-sm"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={saveEdit}>
              Save &amp; resend
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group w-full flex items-start justify-end gap-1.5">
      {onEdit && (
        <button
          type="button"
          onClick={startEdit}
          disabled={disabled}
          aria-label="Edit message"
          title="Edit message"
          className="mt-3 shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-black/5 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0 dark:hover:bg-white/10"
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      <div className="whitespace-pre-wrap max-w-[85%] sm:max-w-lg w-fit px-4 py-3 rounded-[20px] bg-muted break-words">
        <div className="text-sm">
          {message.parts.map((part, i) => {
            switch (part.type) {
              case "text":
                return <Response key={`${message.id}-${i}`}>{part.text}</Response>;
            }
          })}
        </div>
      </div>
    </div>
  );
}
