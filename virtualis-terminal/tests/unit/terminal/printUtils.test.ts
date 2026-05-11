import { describe, expect, it } from "vitest";

import {
  TERMINAL_TEXT_COLUMNS,
  wrapTerminalText,
} from "@/components/Terminal/utils/printUtils";

describe("wrapTerminalText", () => {
  it("wraps prose on word boundaries before the CRT hard-wraps it", () => {
    const lines = wrapTerminalText(
      "The system is also, in a certain sense, self-aware - my own documentation lives in the vector store, making Cogitatio Virtualis itself a portfolio piece that can be queried, inspected, and reasoned about.",
      48,
    );

    expect(lines).toEqual([
      "The system is also, in a certain sense,",
      "self-aware - my own documentation lives in the",
      "vector store, making Cogitatio Virtualis itself",
      "a portfolio piece that can be queried,",
      "inspected, and reasoned about.",
    ]);
    expect(lines.every((line) => line.length <= 48)).toBe(true);
  });

  it("preserves explicit blank lines and wraps each paragraph independently", () => {
    const lines = wrapTerminalText(
      "first paragraph has some words\n\nsecond",
      20,
    );

    expect(lines).toEqual([
      "first paragraph has",
      "some words",
      "\u00A0",
      "second",
    ]);
  });

  it("indents bullet continuations under their original marker", () => {
    const lines = wrapTerminalText(
      "- first item contains enough words to require a continuation line",
      32,
    );

    expect(lines).toEqual([
      "- first item contains enough",
      "  words to require a",
      "  continuation line",
    ]);
  });

  it("keeps default wrapped output inside the CRT text column budget", () => {
    const lines = wrapTerminalText("alpha beta gamma ".repeat(20));

    expect(lines.every((line) => line.length <= TERMINAL_TEXT_COLUMNS)).toBe(
      true,
    );
  });
});
