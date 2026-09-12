"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Conversation,
  listConversations,
  deleteConversation,
  updateConversationTitle,
} from "@/lib/storage";
import { MessageSquare, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RecencyGroup = "today" | "week" | "older";

const GROUP_LABEL: Record<RecencyGroup, string> = {
  today: "Today",
  week: "Previous 7 Days",
  older: "Older",
};
const GROUP_ORDER: RecencyGroup[] = ["today", "week", "older"];

function groupOf(updatedAt: number): RecencyGroup {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (updatedAt >= startOfToday) return "today";
  if (updatedAt >= startOfToday - 7 * 24 * 60 * 60 * 1000) return "week";
  return "older";
}

export function ConversationSidebar({
  activeId,
  onSelect,
  onNew,
  onClose,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    listConversations()
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function refresh() {
    setConversations(listConversations());
  }

  function handleNew() {
    onNew();
    setConfirmingId(null);
    setRenamingId(null);
    setTimeout(() => setConversations(listConversations()), 0);
  }

  function commitRename(id: string, value: string) {
    const trimmed = value.trim();
    // Empty title is rejected — keep the original and just close the field.
    if (trimmed) updateConversationTitle(id, trimmed);
    setRenamingId(null);
    refresh();
  }

  // Deleting the active conversation selects the nearest remaining one
  // (by prior list position) rather than always jumping to a fresh chat.
  function confirmDelete(id: string) {
    const before = conversations;
    const idx = before.findIndex((c) => c.id === id);
    deleteConversation(id);
    setConfirmingId(null);
    const remaining = before.filter((c) => c.id !== id);
    setConversations(remaining);
    if (id === activeId) {
      const next = remaining[idx] ?? remaining[idx - 1] ?? remaining[0];
      if (next) onSelect(next.id);
      else handleNew();
    }
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      <div className="p-3 pt-4">
        <Button
          variant="outline"
          className="w-full justify-center gap-2 rounded-lg border-brand-blue text-brand-blue hover:bg-brand-tint hover:text-brand-blue"
          onClick={handleNew}
        >
          <Plus className="size-4" />
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No conversations yet
          </p>
        ) : (
          GROUP_ORDER.map((group) => {
            const inGroup = conversations.filter((c) => groupOf(c.updatedAt) === group);
            if (inGroup.length === 0) return null;

            return (
              <div key={group} className="mb-3">
                <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {GROUP_LABEL[group]}
                </div>
                <div className="flex flex-col gap-0.5">
                  {inGroup.map((conv) => {
                    const isActive = activeId === conv.id;

                    if (confirmingId === conv.id) {
                      return (
                        <div
                          key={conv.id}
                          className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2 py-1.5"
                        >
                          <span className="flex-1 text-xs text-foreground">
                            Delete this chat?
                          </span>
                          <button
                            type="button"
                            className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-black/5"
                            onClick={() => setConfirmingId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="shrink-0 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-white hover:bg-destructive/90"
                            onClick={() => confirmDelete(conv.id)}
                          >
                            Delete
                          </button>
                        </div>
                      );
                    }

                    if (renamingId === conv.id) {
                      return (
                        <input
                          key={conv.id}
                          defaultValue={conv.title}
                          autoFocus
                          aria-label="Rename chat"
                          onFocus={(e) => e.currentTarget.select()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename(conv.id, e.currentTarget.value);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setRenamingId(null);
                            }
                          }}
                          onBlur={(e) => commitRename(conv.id, e.currentTarget.value)}
                          className="w-full rounded-lg border border-brand-blue bg-background px-2 py-1.5 text-sm text-foreground outline-none"
                        />
                      );
                    }

                    return (
                      <div
                        key={conv.id}
                        className={cn(
                          "group relative flex items-center gap-1 rounded-lg border-l-[3px] border-transparent pr-1 transition-colors",
                          isActive
                            ? "border-l-brand-blue bg-brand-tint"
                            : "hover:bg-muted"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(conv.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
                        >
                          <MessageSquare
                            className={cn(
                              "size-3.5 shrink-0",
                              isActive ? "text-brand-blue" : "text-muted-foreground"
                            )}
                          />
                          <span
                            className={cn(
                              "truncate",
                              isActive ? "font-medium text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {conv.title}
                          </span>
                        </button>

                        <DropdownMenu
                          open={openMenuId === conv.id}
                          onOpenChange={(open) => setOpenMenuId(open ? conv.id : null)}
                        >
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Chat options for ${conv.title}`}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "shrink-0 rounded-md p-1 text-muted-foreground opacity-0 hover:bg-black/5 group-hover:opacity-100 focus-visible:opacity-100",
                                (isActive || openMenuId === conv.id) && "opacity-100"
                              )}
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => setRenamingId(conv.id)}>
                              <Pencil className="size-3.5" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setConfirmingId(conv.id)}
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
