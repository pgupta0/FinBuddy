// lib/attachments.ts
//
// Client-side handling for the paperclip/upload button in app/page.tsx.
//
// Images and PDFs are sent to the model as native FileUIPart attachments
// (Claude reads them directly — no OCR or extraction needed). Plain text
// and CSV files have no such "document" concept in the chat API, so they're
// read as text and folded into the message body instead, wrapped in a
// fenced block so the model can tell where the attachment starts and ends.
//
// Size limits exist because the whole conversation history — attachments
// included — is resent as JSON on every turn, and Vercel serverless
// functions reject request bodies over ~4.5MB. Base64 also inflates a file
// by about a third, so the real ceiling is lower than the raw file size
// suggests. Keep these limits conservative rather than chasing the exact
// platform cap.

import type { FileUIPart } from "ai";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_FILE_SIZE_MB,
  MAX_ATTACHMENT_TEXT_CHARS,
} from "@/config";

export { MAX_ATTACHMENTS_PER_MESSAGE, MAX_ATTACHMENT_FILE_SIZE_MB };

export const MAX_ATTACHMENT_FILE_SIZE_BYTES =
  MAX_ATTACHMENT_FILE_SIZE_MB * 1024 * 1024;

/** Accept string for the hidden <input type="file">. */
export const ATTACHMENT_ACCEPT =
  "image/png,image/jpeg,image/webp,application/pdf,text/csv,text/plain,.csv,.txt";

export type AttachmentKind = "image" | "pdf" | "text";

export type PendingAttachment = {
  id: string;
  file: File;
  kind: AttachmentKind;
  /** Object URL for image thumbnails; revoked when the attachment is removed. */
  previewUrl?: string;
};

export function classifyFile(file: File): AttachmentKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (
    file.type === "text/csv" ||
    file.type === "text/plain" ||
    file.name.endsWith(".csv") ||
    file.name.endsWith(".txt")
  ) {
    return "text";
  }
  return null;
}

/** Validates one incoming file against type/size rules. Returns an error message, or null if it's fine. */
export function validateFile(file: File): string | null {
  const kind = classifyFile(file);
  if (!kind) {
    return `${file.name}: unsupported file type. Please attach an image, PDF, CSV, or text file.`;
  }
  if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
    return `${file.name}: file is too large (max ${MAX_ATTACHMENT_FILE_SIZE_MB}MB per file).`;
  }
  return null;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Converts pending attachments into what sendMessage needs: native file
 * parts for images/PDFs, plus a text block to append to the message for
 * any CSV/text attachments (truncated to stay well under the server's
 * per-message character cap).
 */
export async function buildAttachmentPayload(
  attachments: PendingAttachment[]
): Promise<{ fileParts: FileUIPart[]; textAppendix: string }> {
  const fileParts: FileUIPart[] = [];
  const textBlocks: string[] = [];
  let remainingTextBudget = MAX_ATTACHMENT_TEXT_CHARS;

  for (const attachment of attachments) {
    const { file, kind } = attachment;
    if (kind === "image" || kind === "pdf") {
      const url = await readFileAsDataURL(file);
      fileParts.push({
        type: "file",
        mediaType: file.type || (kind === "pdf" ? "application/pdf" : "application/octet-stream"),
        filename: file.name,
        url,
      });
    } else {
      let text = await readFileAsText(file);
      let truncated = false;
      if (text.length > remainingTextBudget) {
        text = text.slice(0, remainingTextBudget);
        truncated = true;
      }
      remainingTextBudget -= text.length;
      textBlocks.push(
        `Attached file "${file.name}"${truncated ? " (truncated)" : ""}:\n\`\`\`\n${text}\n\`\`\``
      );
      if (remainingTextBudget <= 0) break;
    }
  }

  return { fileParts, textAppendix: textBlocks.join("\n\n") };
}

export function revokePreview(attachment: PendingAttachment) {
  if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
}
