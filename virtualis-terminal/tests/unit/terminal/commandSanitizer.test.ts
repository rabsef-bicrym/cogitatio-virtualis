import { describe, expect, it } from "vitest";
import { LOADING_FRAMES } from "@/components/Terminal/styles/terminal.styles";
import {
  stripLeakedLoaderFrame,
  stripTrailingLoaderFrame,
} from "@/components/Terminal/utils/commandSanitizer";

describe("stripLeakedLoaderFrame", () => {
  it("removes a leaked configured loader frame from command input", () => {
    expect(stripLeakedLoaderFrame("/status⠼", LOADING_FRAMES)).toBe("/status");
  });

  it("removes a leaked leading loader frame from command input", () => {
    expect(stripLeakedLoaderFrame("⠼please think slowly", LOADING_FRAMES)).toBe(
      "please think slowly",
    );
  });

  it("removes leaked leading and trailing loader frames from command input", () => {
    expect(stripLeakedLoaderFrame("⠼/status⠼", LOADING_FRAMES)).toBe("/status");
  });

  it("preserves normal command input", () => {
    expect(stripLeakedLoaderFrame("/status", LOADING_FRAMES)).toBe("/status");
  });

  it("does not turn a standalone loader frame into an empty command", () => {
    expect(stripLeakedLoaderFrame("⠼", LOADING_FRAMES)).toBe("⠼");
  });

  it("keeps the previous trailing-frame helper as a compatibility alias", () => {
    expect(stripTrailingLoaderFrame("/status⠼", LOADING_FRAMES)).toBe(
      "/status",
    );
  });
});
