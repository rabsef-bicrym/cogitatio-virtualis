import { describe, expect, it } from "vitest";
import { LOADING_FRAMES } from "@/components/Terminal/styles/terminal.styles";
import { stripTrailingLoaderFrame } from "@/components/Terminal/utils/commandSanitizer";

describe("stripTrailingLoaderFrame", () => {
  it("removes a leaked configured loader frame from command input", () => {
    expect(stripTrailingLoaderFrame("/status⠼", LOADING_FRAMES)).toBe(
      "/status",
    );
  });

  it("preserves normal command input", () => {
    expect(stripTrailingLoaderFrame("/status", LOADING_FRAMES)).toBe("/status");
  });

  it("does not turn a standalone loader frame into an empty command", () => {
    expect(stripTrailingLoaderFrame("⠼", LOADING_FRAMES)).toBe("⠼");
  });
});
