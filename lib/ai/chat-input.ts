import { z } from "zod";
import type { UIMessage } from "ai";
import { MAX_MESSAGES, MAX_MESSAGE_TEXT_LENGTH } from "@/config";
const part = z.object({ type: z.string().min(1) }).passthrough().superRefine((p, ctx) => {
  if (p.type === "text" && (typeof p.text !== "string" || p.text.length > MAX_MESSAGE_TEXT_LENGTH)) ctx.addIssue({ code:"custom", message:"Invalid or oversized text part" });
  if (p.type === "file" && (typeof p.url !== "string" || typeof p.mediaType !== "string")) ctx.addIssue({ code:"custom", message:"Invalid attachment part" });
});
const bodySchema = z.object({ messages: z.array(z.object({ id:z.string().min(1).max(128), role:z.enum(["user","assistant"]), parts:z.array(part).max(200) }).passthrough()).min(1).max(MAX_MESSAGES) }).passthrough();
/** Shape validation only. Tool payloads and financial content still need their own checks. */
export function parseChatInput(body: unknown): UIMessage[] | null {
  const parsed = bodySchema.safeParse(body);
  return parsed.success ? parsed.data.messages as unknown as UIMessage[] : null;
}
