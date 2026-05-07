import { afterEach, describe, expect, it, vi } from "vitest";
import { startAmbientWaitTicker } from "@/lib/chat/ambientWaitTicker";

describe("startAmbientWaitTicker", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits generated ambient lines on the configured interval", async () => {
    vi.useFakeTimers();
    const send = vi.fn();

    const ticker = startAmbientWaitTicker({
      writer: { send },
      generateLines: () =>
        Promise.resolve(["measuring twice", "emitting once"]),
      intervalMs: 10,
      maxLines: 2,
    });

    await vi.advanceTimersByTimeAsync(9);
    expect(send).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledWith({
      type: "progress",
      message: ">>> measuring twice",
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(send).toHaveBeenCalledWith({
      type: "progress",
      message: ">>> emitting once",
    });

    await vi.advanceTimersByTimeAsync(20);
    expect(send).toHaveBeenCalledTimes(2);
    ticker.stop();
  });

  it("stops before emitting when stopped early", async () => {
    vi.useFakeTimers();
    const send = vi.fn();

    const ticker = startAmbientWaitTicker({
      writer: { send },
      generateLines: () => Promise.resolve(["quiet machinery"]),
      intervalMs: 10,
      maxLines: 1,
    });

    ticker.stop();
    await vi.advanceTimersByTimeAsync(20);

    expect(send).not.toHaveBeenCalled();
  });
});
