"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";

// enable inline $...$ math (plugin default only renders $$...$$ display math)
const math = createMathPlugin({ singleDollarTextMath: true });

type ResponseProps = ComponentProps<typeof Streamdown> & {
  isAnimating?: boolean;
};

// Allow all elements to render (override rehype-harden default blocking)
const allowElement = () => true;

/**
 * KaTeX's default fonts have no glyph for "₹" (U+20B9) in ANY style — not
 * math mode, not \text{} mode either (both throw "No character metrics for
 * '₹'" — confirmed via the 2026-09-15 QA pass, reproducible on every formula
 * containing a rupee amount). Wrapping it in \text{} doesn't help, since the
 * font itself is what's missing the glyph. The only reliable fix is to keep
 * "₹" out of math delimiters entirely — swap it for the ASCII "Rs." there.
 * Left untouched outside math, where it's just a plain HTML character and
 * renders fine.
 */
function sanitizeCurrencyInMath(text: string): string {
  const stripRupee = (math: string) => math.replace(/₹/g, "Rs.");
  // Display math ($$...$$) first, since it can span multiple lines and would
  // otherwise be partially consumed by the single-$ pass below.
  let s = text.replace(/\$\$[\s\S]*?\$\$/g, stripRupee);
  // Inline math ($...$), kept on one line so it can't accidentally swallow
  // an unrelated later "$" further down the message.
  s = s.replace(/\$[^$\n]+?\$/g, stripRupee);
  return s;
}

/**
 * Sanitize response text before rendering:
 * - Remove [blocked] artifacts from empty markdown links
 * - Remove empty markdown links like [text]() that cause [blocked]
 * - Keep "₹" out of KaTeX math (see sanitizeCurrencyInMath above)
 */
function sanitizeResponseText(text: string): string {
  if (!text) return text;
  let s = text;
  // Remove markdown links with empty URLs: [text]() → text
  s = s.replace(/\[([^\]]+)\]\(\s*\)/g, "$1");
  // Remove [blocked] text
  s = s.replace(/ ?\[blocked\]/g, "");
  // During streaming, the token boundary can land mid-artifact — "...112A
  // [blocked" arrives a render or two before the closing "]" does, so the
  // regex above hasn't matched yet and the raw fragment flashes on screen for
  // a moment. Strip that partial form too when it's sitting at the very end
  // of the text received so far (never matches mid-sentence, only a
  // still-streaming trailing edge).
  s = s.replace(/ ?\[blocked?$/, "");
  s = sanitizeCurrencyInMath(s);
  return s;
}

export const Response = memo(
  ({ className, children, isAnimating, ...props }: ResponseProps) => {
    const shouldAnimate = isAnimating ?? false;
    return (
      <Streamdown
        className={cn(
          "size-full leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
        plugins={{ code, math }}
        animated={
          shouldAnimate
            ? { animation: "fadeIn", duration: 75, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
            : false
        }
        isAnimating={shouldAnimate}
        allowElement={allowElement}
        {...props}
      >
        {typeof children === "string" ? sanitizeResponseText(children) : children}
      </Streamdown>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.isAnimating === nextProps.isAnimating
);
