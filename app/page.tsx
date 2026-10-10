"use client";

import { LearnerOnboarding } from "@/components/learner-onboarding";
import { needsLearnerOnboarding, firstLessonPrompt, type LearnerProfile } from "@/lib/learner-profile";
import { loadLearnerProfile, saveLearnerProfile, deleteLearnerProfile } from "@/lib/learner-profile-storage";
import { visibleAssistantText } from "@/lib/governance/display";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import {
  ArrowUp,
  Download,
  FileText,
  Mic,
  Paperclip,
  PanelLeft,
  Plus,
  Square,
  X,
} from "lucide-react";
import { ThinkingIndicator } from "@/components/ai-elements/thinking-indicator";
import { MessageWall } from "@/components/messages/message-wall";
import { ChatHeader, ChatHeaderBlock } from "@/app/parts/chat-header";
import { WelcomeHero } from "@/app/parts/welcome-hero";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState, useRef, useCallback } from "react";
import { AI_NAME, CLEAR_CHAT_TEXT, OWNER_NAME, WELCOME_MESSAGE, COMPACTION_ENABLED, COMPACTION_TOKEN_THRESHOLD, COMPACTION_SHOW_CONTEXT_MEMORY, MAX_MESSAGE_TEXT_LENGTH } from "@/config";
import Image from "next/image";
import Link from "next/link";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ModelPicker, type ModelChoice } from "@/components/model-picker";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS_PER_MESSAGE,
  buildAttachmentPayload,
  classifyFile,
  revokePreview,
  validateFile,
  type PendingAttachment,
} from "@/lib/attachments";
import {
  createConversation,
  loadConversationData,
  saveConversationData,
  migrateFromLegacyStorage,
  listConversations,
  loadCompactedSummary,
  saveCompactedSummary,
  loadFeedback,
} from "@/lib/storage";

const formSchema = z.object({
  // No .min(1): an attachment-only message (e.g. just a photo) is valid.
  // submitText() itself refuses to send when there's neither text nor a
  // file, and the send button is disabled for that same case.
  message: z
    .string()
    // Same limit the server enforces (config.ts), so the form never accepts
    // a message the API would reject.
    .max(MAX_MESSAGE_TEXT_LENGTH, `Message must be at most ${MAX_MESSAGE_TEXT_LENGTH} characters.`),
});

export default function Chat() {
  const [isClient, setIsClient] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  // Session cache; dialog display uses learnerInitial state.
  const [learnerProfiles] = useState(() => new Map<string, LearnerProfile>());
  const [learnerOpen, setLearnerOpen] = useState(false);
  const [learnerInitial, setLearnerInitial] = useState<LearnerProfile | null>(null);
  const pendingLesson = useRef<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showContextMemory, setShowContextMemory] = useState(false);
  const welcomeMessageShownRef = useRef<boolean>(false);

  // Files/images attached to the *next* message via the paperclip button.
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Snapshot of whatever was already typed when the mic starts, so the
  // running speech transcript is appended to it rather than replacing it.
  const dictationBaseTextRef = useRef("");

  // Compaction state: stored summary persists across requests
  const summaryRef = useRef<{ summary: string; summarizedUpTo: number; signature: string } | null>(null);
  const activeConvIdRef = useRef<string | null>(null);

  // Model chosen in the header picker. Held in a ref, not state: the transport's
  // fetch wrapper below is created once, so it must read the CURRENT value at
  // request time rather than close over whatever was selected on first render.
  // Null simply means "no preference" — the server uses its configured default.
  const selectedModelRef = useRef<ModelChoice | null>(null);
  const handleModelChange = useCallback((choice: ModelChoice | null) => {
    selectedModelRef.current = choice;
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  // Load stored summary when conversation changes
  useEffect(() => {
    if (isClient && activeConvId) {
      const stored = loadCompactedSummary(activeConvId);
      summaryRef.current = stored;
    }
  }, [isClient, activeConvId]);

  // Stable reference (functional setState needs no deps) — passed straight
  // through MessageWall to every AssistantMessage. An inline arrow function
  // here would get a new identity every render, which defeats that
  // component's React.memo and forces every past message to redo its
  // citation-rewrite work on every streamed token.
  const handleDurationChange = useCallback((key: string, duration: number) => {
    setDurations((prev) => ({
      ...prev,
      [key]: duration,
    }));
  }, []);

  const { messages, sendMessage, status, stop, setMessages, addToolOutput, regenerate } = useChat({
    // Once the interactive risk-quiz widget (a client-side tool with no
    // execute — see app/api/chat/tools/present-risk-quiz.ts) resolves via
    // addToolOutput, this automatically re-sends to the server so the model
    // continues (scoreRiskProfile, the KB search, the recommendation) without
    // the user needing to type anything.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: async (url, options) => {
        // Inject compaction summary via headers (body modification doesn't work with SDK)
        const headers = new Headers(options?.headers);
        if (summaryRef.current) {
          headers.set("X-Compacted-Summary", btoa(unescape(encodeURIComponent(summaryRef.current.summary))));
          headers.set("X-Compacted-UpTo", String(summaryRef.current.summarizedUpTo));
          headers.set("X-Compacted-Signature", summaryRef.current.signature);
          // Debug: console.log(`COMPACTION: sending ${summaryRef.current.summary.length} chars, upTo: ${summaryRef.current.summarizedUpTo}`);
        }
        // Send feedback ratings for compaction quality
        if (activeConvIdRef.current) {
          const fb = loadFeedback(activeConvIdRef.current);
          if (Object.keys(fb).length > 0) {
            headers.set("X-Feedback", btoa(JSON.stringify(fb)));
          }
        }
        const learning = activeConvIdRef.current ? learnerProfiles.get(activeConvIdRef.current) : null;
        if (learning) headers.set("X-Learner-Preferences", JSON.stringify(learning.preferences));
        // Model chosen in the header picker. The server treats these as
        // untrusted and re-validates them against the catalog and the keys it
        // actually has (see routeRequest in lib/ai/routing.ts), so an unknown
        // or unservable pair is ignored rather than trusted.
        const chosen = selectedModelRef.current;
        if (chosen) {
          headers.set("X-Model-Vendor", chosen.vendor);
          headers.set("X-Model-Id", chosen.modelId);
        }
        let response: Response;
        try {
          response = await fetch(url, { ...options, headers });
        } catch (err) {
          // A request that dies mid-stream (the connection drops, a proxy
          // times out, the tab's network throttles it) surfaces here as a
          // rejected fetch — e.g. Chrome's net::ERR_ABORTED, seen in the
          // 2026-09-15 QA pass on longer/tool-heavy answers. Left alone, that
          // rejection propagates as whatever cryptic text the browser used
          // ("Failed to fetch", "The operation was aborted") and — worse — the
          // user is left staring at a composer that's already back to its
          // normal "ready to send" state, with nothing in the transcript
          // marking that their message never got an answer. Rethrowing with a
          // clear, specific message at least makes the onError toast below
          // tell them what actually happened and that retrying is the right
          // move, instead of a generic/confusing browser error string.
          const cause = err instanceof Error ? err.message : String(err);
          throw new Error(
            `Lost connection before FinBuddy finished replying (${cause}). Please try again — if it keeps happening, the model may be rate-limited; try a different one from the picker.`
          );
        }

        // Read updated summary from response headers
        const newSummaryB64 = response.headers.get("X-Compacted-Summary");
        const newUpTo = response.headers.get("X-Compacted-UpTo");
        const newSignature = response.headers.get("X-Compacted-Signature");
        // Debug: console.log(`COMPACTION: received summary=${!!newSummaryB64}, upTo=${newUpTo}`);
        if (newSummaryB64 && newUpTo && newSignature && activeConvIdRef.current) {
          try {
            const summary = decodeURIComponent(escape(atob(newSummaryB64)));
            const summarizedUpTo = parseInt(newUpTo, 10);
            summaryRef.current = { summary, summarizedUpTo, signature: newSignature };
            saveCompactedSummary(activeConvIdRef.current, summary, summarizedUpTo, newSignature);
            // Debug: console.log(`COMPACTION: saved ${summary.length} chars, upTo: ${summarizedUpTo}`);
          } catch (e) {
            console.warn("Compaction save failed:", e);
          }
        }

        return response;
      },
    }),
    experimental_throttle: 50,
    onError(error) {
      // Longer duration than sonner's default (~4s): an error toast that
      // vanishes before the user looks up is functionally the same as no
      // error at all — see the "silent failure" finding in the
      // 2026-09-15 QA pass (claude/finbuddy-gemini-qa-test-2026-09-15.md in
      // the project). This doesn't add a persistent in-transcript failure
      // marker (a bigger UI change), but it at least gives a real chance of
      // being seen.
      toast.error(error.message || "Something went wrong. Please try again.", {
        duration: 10000,
      });
    },
  });

  // Initialize: migrate legacy storage, load or create conversation
  useEffect(() => {
    setIsClient(true);

    // Migrate from old single-chat format if present
    const migratedId = migrateFromLegacyStorage();

    const convs = listConversations();
    let convId: string;

    if (migratedId) {
      convId = migratedId;
    } else if (convs.length > 0) {
      convId = convs[0].id; // most recent
    } else {
      const newConv = createConversation();
      convId = newConv.id;
    }

    activeConvIdRef.current = convId;
    const learning = loadLearnerProfile(convId);
    if (learning) learnerProfiles.set(convId, learning);
    setActiveConvId(convId);
    const data = loadConversationData(convId);
    setMessages(data.messages);
    setDurations(data.durations);

    // Show welcome message if this is a fresh conversation
    if (data.messages.length === 0 && !welcomeMessageShownRef.current) {
      const welcomeMessage: UIMessage = {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        parts: [{ type: "text", text: WELCOME_MESSAGE }],
      };
      setMessages([welcomeMessage]);
      saveConversationData(convId, {
        messages: [welcomeMessage],
        durations: {},
      });
      welcomeMessageShownRef.current = true;
    }
  }, [learnerProfiles, setMessages]);

  // Persist messages whenever they change (preserving compaction fields)
  useEffect(() => {
    if (isClient && activeConvId) {
      const existing = loadConversationData(activeConvId);
      saveConversationData(activeConvId, {
        messages,
        durations,
        ...(existing.compactedSummary ? { compactedSummary: existing.compactedSummary } : {}),
        ...(existing.summarizedUpTo !== undefined ? { summarizedUpTo: existing.summarizedUpTo } : {}),
        ...(existing.compactedSignature ? { compactedSignature: existing.compactedSignature } : {}),
      });
    }
  }, [durations, messages, isClient, activeConvId]);

  // Compaction notification is handled by the model in its response text
  // (server instructs the model to include a notice when compaction occurs)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });

  // Speech-to-text: dictates into whatever's already in the textarea rather
  // than replacing it. Browser support (Web Speech API) varies — see
  // hooks/use-speech-recognition.ts — so the mic button only renders when
  // isSupported is true.
  const speech = useSpeechRecognition({
    onResult: (transcript) => {
      const base = dictationBaseTextRef.current;
      const joined = base ? `${base} ${transcript}` : transcript;
      form.setValue("message", joined, { shouldValidate: true });
    },
  });

  function toggleDictation() {
    if (speech.isListening) {
      speech.stop();
      return;
    }
    dictationBaseTextRef.current = form.getValues("message").trim();
    speech.start();
  }

  // --- Attachments (paperclip button) ---
  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);

    if (attachments.length + incoming.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
      return;
    }

    const next: PendingAttachment[] = [];
    for (const file of incoming) {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        continue;
      }
      const kind = classifyFile(file)!;
      next.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        kind,
        previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
      });
    }
    if (next.length > 0) setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) revokePreview(target);
      return prev.filter((a) => a.id !== id);
    });
  }

  // Revoke any remaining preview object URLs on unmount.
  useEffect(() => {
    return () => {
      attachments.forEach(revokePreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Single send path, shared by the textarea and the landing-screen starter
  // cards, so a clicked card is indistinguishable from a typed message
  // (same compaction headers, same history, same moderation).
  async function submitText(text: string, files: PendingAttachment[] = []) {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return;
    const id = activeConvIdRef.current;
    if (files.length === 0 && id && !learnerProfiles.has(id) && needsLearnerOnboarding(trimmed)) {
      pendingLesson.current = trimmed;
      setLearnerInitial(null);
      setLearnerOpen(true);
      return;
    }

    const { fileParts, textAppendix } = await buildAttachmentPayload(files);
    const finalText = textAppendix ? `${trimmed}\n\n${textAppendix}`.trim() : trimmed;

    // Include stored summary in the request body for stateful compaction
    const s = summaryRef.current;
    sendMessage({
      text: finalText,
      files: fileParts,
      body: s ? { compactedSummary: s.summary, summarizedUpTo: s.summarizedUpTo } : undefined,
    } as any);
    form.reset();
    files.forEach(revokePreview);
    setAttachments([]);
  }

  function completeLearning(profile: LearnerProfile) {
    const id = activeConvIdRef.current;
    if (!id) return;
    const startLesson = pendingLesson.current !== null;
    if (startLesson) profile = { ...profile, exploredTopics: [...new Set([...profile.exploredTopics, profile.preferences.goal])] };
    learnerProfiles.set(id, profile);
    if (!saveLearnerProfile(id, profile)) toast.error("Could not save on this device. Preferences are available for this page session.");
    setLearnerOpen(false);
    pendingLesson.current = null;
    if (startLesson) void submitText(firstLessonPrompt(profile.preferences));
  }

  function onSubmit(data: z.infer<typeof formSchema>) {
    submitText(data.message, attachments);
  }

  // Editing a user message drops it and everything after it, then resends
  // the edited text as a fresh turn — same mental model as retyping the
  // message, minus losing your place in the conversation. Any attachments
  // on the original message are not carried over to the edit.
  function editUserMessage(messageId: string, newText: string) {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    setMessages(messages.slice(0, idx));
    submitText(newText);
  }

  // The landing screen replaces the message wall until the user's first turn.
  // Keyed off user messages (not messages.length) because a fresh conversation
  // already holds the seeded WELCOME_MESSAGE assistant bubble.
  const showHero =
    isClient && status === "ready" && !messages.some((m) => m.role === "user");

  function switchConversation(id: string) {
    activeConvIdRef.current = id;
    summaryRef.current = loadCompactedSummary(id);
    const learning = loadLearnerProfile(id);
    if (learning) learnerProfiles.set(id, learning);
    setLearnerOpen(false);
    pendingLesson.current = null;
    setActiveConvId(id);
    const data = loadConversationData(id);
    setMessages(data.messages);
    setDurations(data.durations);
    welcomeMessageShownRef.current = true;
  }

  function newChat() {
    const conv = createConversation();
    activeConvIdRef.current = conv.id;
    summaryRef.current = null;
    setLearnerOpen(false);
    pendingLesson.current = null;
    setActiveConvId(conv.id);
    setDurations({});
    welcomeMessageShownRef.current = false;

    const welcomeMessage: UIMessage = {
      id: `welcome-${Date.now()}`,
      role: "assistant",
      parts: [{ type: "text", text: WELCOME_MESSAGE }],
    };
    setMessages([welcomeMessage]);
    saveConversationData(conv.id, {
      messages: [welcomeMessage],
      durations: {},
    });
    welcomeMessageShownRef.current = true;
    toast.success("New chat started");
  }

  function exportChat() {
    if (messages.length === 0) {
      toast.error("No messages to export");
      return;
    }

    const markdown = messages
      .map((msg) => {
        const role = msg.role === "user" ? "You" : AI_NAME;
        const text =
          msg.role === "assistant"
            ? visibleAssistantText(msg)
            : msg.parts
                .filter((p) => p.type === "text")
                .map((p: any) => p.text)
                .join("\n");
        return `### ${role}\n\n${text}`;
      })
      .join("\n\n---\n\n");

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${AI_NAME}-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Chat exported");
  }

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "k") {
        e.preventDefault();
        newChat();
      }

      if (
        e.key === "Escape" &&
        (status === "streaming" || status === "submitted")
      ) {
        e.preventDefault();
        stop();
      }

      if (isMod && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    },
    [status, stop]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-dvh overflow-hidden font-sans dark:bg-black">
      {/* Sidebar — overlay on mobile (<md), inline on desktop */}
      {isClient && sidebarOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 md:static md:z-auto">
            <ConversationSidebar
              key={`sidebar-${activeConvId}-${messages.length}`}
              activeId={activeConvId}
              onSelect={(id) => {
                switchConversation(id);
                if (typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches) setSidebarOpen(false);
              }}
              onNew={() => {
                newChat();
                if (typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches) setSidebarOpen(false);
              }}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </>
      )}

      {learnerOpen && <LearnerOnboarding open initial={learnerInitial}
        onClose={() => { setLearnerOpen(false); pendingLesson.current = null; }}
        onComplete={completeLearning}
        onSkip={() => { const start = pendingLesson.current !== null; pendingLesson.current = null; setLearnerOpen(false); if (start) void submitText("Explain saving versus investing briefly as general financial education. Do not recommend investments for me."); }}
        onForget={() => { if (activeConvId) { learnerProfiles.delete(activeConvId); deleteLearnerProfile(activeConvId); } pendingLesson.current = null; setLearnerOpen(false); toast.success("Learning preferences deleted"); }} />}
      <main className="brand-surface relative flex h-dvh min-w-0 flex-1 flex-col">
        <div className="relative z-50 shrink-0">
          <ChatHeader>
            <ChatHeaderBlock className="flex-none items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label="Toggle sidebar"
              >
                <PanelLeft className="size-4" />
              </Button>
            </ChatHeaderBlock>
            <ChatHeaderBlock className="min-w-0 items-center">
              <Image
                src="/finbuddy-wordmark.png"
                alt={AI_NAME}
                width={961}
                height={230}
                priority
                className="h-5 w-auto select-none sm:h-6 dark:brightness-0 dark:invert"
              />
            </ChatHeaderBlock>

            <ChatHeaderBlock className="flex-none items-center justify-end gap-1 sm:gap-2">
              {/* Model picker. Renders nothing unless this deployment can serve
                  more than one model (see /api/models), so a single-provider
                  deployment looks exactly as it did before. */}
              <ModelPicker onChange={handleModelChange} />

              {/* Context Memory dropdown (toggle via COMPACTION_SHOW_CONTEXT_MEMORY in config) */}
              {(() => {
                if (!COMPACTION_SHOW_CONTEXT_MEMORY) return null;
                const cs = activeConvId ? loadCompactedSummary(activeConvId) : null;
                if (!cs) return null;
                return (
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowContextMemory(!showContextMemory)}
                      aria-label="Context Memory"
                      className="h-8 w-8"
                      title={`Context Memory (${cs.summarizedUpTo} messages summarized)`}
                    >
                      <FileText className="size-4" />
                    </Button>
                    {showContextMemory && (
                      <div className="absolute right-0 top-10 z-50 w-80 max-h-64 overflow-y-auto rounded-md border bg-background p-3 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">Context Memory</span>
                          <span className="text-[10px] text-muted-foreground">{cs.summarizedUpTo} messages summarized</span>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {cs.summary}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
              <Button
                variant="ghost"
                size="icon"
                onClick={exportChat}
                aria-label="Export chat"
                className="hidden h-8 w-8 sm:inline-flex"
              >
                <Download className="size-4" />
              </Button>
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={newChat} aria-label="New chat">
                <Plus className="size-4" />
                <span className="hidden sm:inline">{CLEAR_CHAT_TEXT}</span>
              </Button>
            </ChatHeaderBlock>
          </ChatHeader>
        </div>

        <div className="min-h-0 w-full flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div
            className={`flex min-h-full flex-col items-center ${
              showHero ? "justify-center" : "justify-end"
            }`}
          >
            {showHero && (
              <WelcomeHero onSelect={submitText} disabled={status !== "ready"} />
            )}

            {isClient && !showHero && (
              <>
                <MessageWall
                  messages={messages}
                  status={status}
                  durations={durations}
                  conversationId={activeConvId ?? undefined}
                  onDurationChange={handleDurationChange}
                  addToolOutput={addToolOutput}
                  onRegenerate={(messageId) => regenerate({ messageId })}
                  onEditMessage={editUserMessage}
                />
                {status === "submitted" && (
                  <div className="max-w-3xl w-full">
                    <ThinkingIndicator isCompacting={(() => {
                      if (!COMPACTION_ENABLED || messages.length <= 4) return false;
                      let chars = 0;
                      for (const msg of messages) {
                        for (const part of msg.parts) {
                          const p = part as any;
                          chars += p.type === "text" ? (p.text?.length ?? 0) : JSON.stringify(p).length;
                        }
                      }
                      return Math.ceil(chars / 4) >= COMPACTION_TOKEN_THRESHOLD;
                    })()} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Solid, blurred composer bar — the previous from/via/to gradient
            left the textarea sitting in a partly-transparent zone, so
            scrolled message text visibly showed through around it. The
            short fade above the bar (.message-fade-overlay) still handles
            the transition from scrolled content into the bar; the bar
            itself now stays opaque throughout, like Claude/ChatGPT/Grok. */}
        <div className="relative z-40 shrink-0 border-t border-border/60 bg-background/95 pb-3 pt-3 backdrop-blur-md">
          <div className="relative mx-auto max-w-3xl px-3 sm:px-5">
            {!showHero && <div className="message-fade-overlay" />}

            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    className="group relative flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-1.5 pr-7 text-xs"
                  >
                    {a.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.previewUrl}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground">
                        <FileText className="size-4" />
                      </span>
                    )}
                    <span className="max-w-32 truncate text-foreground">{a.file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      aria-label={`Remove ${a.file.name}`}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
                <Controller
                  name="message"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel className="sr-only">Message</FieldLabel>

                      <div className="relative">
                        {/* Multi-line input: Enter sends, Shift+Enter inserts a
                            newline. Grows with content (field-sizing) up to
                            max-h, then scrolls. Left padding makes room for
                            the paperclip + mic buttons, right for send/stop. */}
                        <Textarea
                          {...field}
                          rows={1}
                          className="min-h-14 max-h-48 resize-none overflow-y-auto rounded-[20px] bg-card pl-[76px] pr-14 py-[18px] leading-5"
                          placeholder="Ask about investing…"
                          disabled={status === "streaming"}
                          aria-invalid={fieldState.invalid}
                          autoComplete="off"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              form.handleSubmit(onSubmit)();
                            }
                          }}
                        />

                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept={ATTACHMENT_ACCEPT}
                          className="hidden"
                          onChange={(e) => {
                            addFiles(e.target.files);
                            e.target.value = ""; // allow re-selecting the same file
                          }}
                        />

                        <div className="absolute bottom-2.5 left-2 flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full"
                            disabled={status === "streaming"}
                            onClick={() => fileInputRef.current?.click()}
                            aria-label="Attach a file or image"
                            title="Attach a file or image"
                          >
                            <Paperclip className="size-4" />
                          </Button>

                          {speech.isSupported && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={`h-9 w-9 rounded-full ${speech.isListening ? "text-destructive animate-pulse" : ""}`}
                              disabled={status === "streaming"}
                              onClick={toggleDictation}
                              aria-label={speech.isListening ? "Stop dictation" : "Dictate your message"}
                              title={speech.isListening ? "Stop dictation" : "Dictate your message"}
                            >
                              <Mic className="size-4" />
                            </Button>
                          )}
                        </div>

                        {(status === "ready" || status === "error") && (
                          <Button
                            className="absolute bottom-2.5 right-3 rounded-full"
                            type="submit"
                            disabled={!field.value?.trim() && attachments.length === 0}
                            size="icon"
                          >
                            <ArrowUp className="size-4" />
                          </Button>
                        )}

                        {(status === "streaming" ||
                          status === "submitted") && (
                          <Button
                            className="absolute bottom-2.5 right-3 rounded-full"
                            size="icon"
                            type="button"
                            onClick={() => stop()}
                          >
                            <Square className="size-4" />
                          </Button>
                        )}
                      </div>
                    </Field>
                  )}
                />
              </FieldGroup>
            </form>

            <div className="mt-2 text-center text-xs text-muted-foreground">
              <span className="hidden sm:inline">&copy; {new Date().getFullYear()} {OWNER_NAME} &middot;{" "}</span>
              <button type="button" disabled={status === "streaming" || status === "submitted"} onClick={() => { pendingLesson.current = null; setLearnerInitial(activeConvId ? learnerProfiles.get(activeConvId) ?? null : null); setLearnerOpen(true); }} className="mr-2 underline">Learning preferences</button>
              <Link href="/terms" className="underline">
                Terms of Use
              </Link>{" "}
              &middot; Education, not investment advice.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
