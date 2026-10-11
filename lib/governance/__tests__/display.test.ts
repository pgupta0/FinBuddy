import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";
import { visibleAssistantText } from "../display";
import { STANDARD_DISCLAIMER, WITHHELD_REDIRECT } from "../constants";

function message(verdict?: {label: "GREEN" | "AMBER" | "RED"; withheld: boolean; appendDisclaimer: boolean}): UIMessage {
  return {id: "test", role: "assistant", parts: [
    {type: "text", text: "You should buy this fund."},
    ...(verdict ? [{type: "data-compliance" as const, data: verdict}] : []),
  ]};
}

describe("checked answer display and export", () => {
  it("does not expose a draft without a server verdict", () => {
    expect(visibleAssistantText(message())).toBe("");
  });
  it("replaces withheld text with the educational redirect", () => {
    expect(visibleAssistantText(message({label: "RED", withheld: true, appendDisclaimer: true}))).toBe(WITHHELD_REDIRECT);
  });
  it("delivers a checked answer with the required missing disclaimer", () => {
    const m = message({label: "GREEN", withheld: false, appendDisclaimer: true});
    m.parts[0] = {type: "text", text: "An expense ratio describes a fund’s annual expenses."};
    expect(visibleAssistantText(m)).toContain(STANDARD_DISCLAIMER);
  });
  it("strips the internal compliance block from checked copy/export", () => {
    const m = message({label: "GREEN", withheld: false, appendDisclaimer: false});
    m.parts[0] = {type: "text", text: 'Educational explanation.\n\n' + '\x60\x60\x60compliance\n{"label":"GREEN"}\n\x60\x60\x60'};
    expect(visibleAssistantText(m)).toBe("Educational explanation.");
  });
  it("allows static server refusals carrying a verdict", () => {
    const m = message({label: "GREEN", withheld: false, appendDisclaimer: false});
    m.parts[0] = {type: "text", text: "Please ask something else."};
    expect(visibleAssistantText(m)).toBe("Please ask something else.");
  });
});
