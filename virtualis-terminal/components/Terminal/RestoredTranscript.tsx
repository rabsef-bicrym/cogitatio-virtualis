import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ThreadMessage } from "@/lib/chat/messageCodec";
import { buildTranscriptLines } from "@/components/Terminal/utils/threadTranscript";

interface RestoredTranscriptProps {
  thread: ThreadMessage[];
}

/**
 * Renders persisted thread history directly into crt-terminal's scrollback.
 */
export function RestoredTranscript({ thread }: RestoredTranscriptProps) {
  const [transcriptElement, setTranscriptElement] =
    useState<HTMLElement | null>(null);
  const transcriptLines = buildTranscriptLines(thread);

  useEffect(() => {
    const screen = document.querySelector<HTMLElement>(
      "[data-terminal-surface] .crt-screen",
    );
    if (!screen?.parentElement) return;

    const transcript = document.createElement("div");
    transcript.className = "crt-restored-transcript-slot";
    screen.parentElement.insertBefore(transcript, screen);
    const animationFrame = window.requestAnimationFrame(() => {
      setTranscriptElement(transcript);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      transcript.remove();
      setTranscriptElement(null);
    };
  }, []);

  useEffect(() => {
    if (!transcriptElement) return;

    const scrollToPrompt = () => {
      const scrollContainer = transcriptElement.closest<HTMLElement>(
        ".crt-terminal__overflow-container",
      );
      if (!scrollContainer) return;

      const commandInput = scrollContainer.querySelector<HTMLElement>(
        ".crt-terminal__command-line",
      );
      commandInput?.scrollIntoView({ block: "end" });
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    };

    const animationFrame = window.requestAnimationFrame(scrollToPrompt);
    const resizeObserver = new ResizeObserver(scrollToPrompt);
    const scrollContainer = transcriptElement.closest<HTMLElement>(
      ".crt-terminal__overflow-container",
    );

    if (scrollContainer) {
      resizeObserver.observe(scrollContainer);
    }
    resizeObserver.observe(transcriptElement);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [transcriptElement, transcriptLines.length]);

  if (!transcriptElement || transcriptLines.length === 0) {
    return null;
  }

  return createPortal(
    <div className="crt-restored-transcript" aria-label="Restored transcript">
      {transcriptLines.map((line, index) => (
        <div
          className={`crt-restored-line line-${line.role}`}
          key={`${index}-${line.role}-${line.text}`}
        >
          <span className={`crt-restored-word message-${line.role}`}>
            {line.text}
          </span>
        </div>
      ))}
    </div>,
    transcriptElement,
  );
}
