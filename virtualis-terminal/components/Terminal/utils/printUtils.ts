import {
  textLine,
  textWord,
  buttonWord,
  commandWord,
  anchorWord,
  Words,
  Lines,
  TerminalProps,
} from "crt-terminal";

export { textWord, buttonWord, commandWord, anchorWord };
export type PrintableItem = NonNullable<TerminalProps["banner"]>;
export type { Words, Lines };

type ButtonCallback = (
  e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
) => void;
type AnchorCallback = (
  e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
) => void;

interface BaseWordConfig {
  characters: string;
  className?: string;
  id?: string;
  dataAttribute?: string;
}

export const TERMINAL_TEXT_COLUMNS = 68;

const BLANK_LINE = "\u00A0";

export type WordConfig = BaseWordConfig &
  (
    | { type: "text" }
    | { type: "button"; onClick: ButtonCallback }
    | { type: "anchor"; href: string; onClick?: AnchorCallback }
    | { type: "command"; prompt: string }
  );

export interface LineOptions {
  lineClassName?: string;
  dataAttribute?: string;
  id?: string;
}

const createWord = (config: WordConfig): Words => {
  const { characters, className, id, dataAttribute } = config;
  const baseProps = { characters, className, id, dataAttribute };

  switch (config.type) {
    case "command":
      return commandWord({
        ...baseProps,
        prompt: config.prompt || "",
      });

    case "button":
      return buttonWord({
        ...baseProps,
        onClick: config.onClick || (() => {}),
      });

    case "anchor":
      return anchorWord({
        ...baseProps,
        href: config.href || "#",
        onClick: config.onClick,
      });

    case "text":
    default:
      return textWord(baseProps);
  }
};

const createLine = (words: WordConfig[], options?: LineOptions): Lines => {
  return textLine({
    words: words.map(createWord),
    className: options?.lineClassName,
    dataAttribute: options?.dataAttribute,
    id: options?.id,
  });
};

export const sendLine = (
  words: WordConfig[],
  options?: LineOptions,
): PrintableItem => {
  return [createLine(words, options)];
};

export const sendMultiLine = (
  lines: { words: WordConfig[]; options?: LineOptions }[],
): PrintableItem => {
  return lines.map((line) => createLine(line.words, line.options));
};

const getContinuationPrefix = (line: string): string => {
  const prefix = line.match(/^(\s*(?:[-*]\s+|\d+\.\s+|>\s+)?)/)?.[1] ?? "";
  return " ".repeat(prefix.length);
};

const wrapTerminalLine = (
  line: string,
  width = TERMINAL_TEXT_COLUMNS,
): string[] => {
  if (!line.trim()) {
    return [BLANK_LINE];
  }

  if (line.length <= width) {
    return [line];
  }

  const initialPrefix =
    line.match(/^(\s*(?:[-*]\s+|\d+\.\s+|>\s+)?)/)?.[1] ?? "";
  const continuationPrefix = getContinuationPrefix(line);
  const wrapped: string[] = [];
  let prefix = initialPrefix;
  let remaining = line.slice(initialPrefix.length);

  while (prefix.length + remaining.length > width) {
    const availableWidth = Math.max(1, width - prefix.length);
    let breakIndex = remaining.lastIndexOf(" ", availableWidth);

    if (breakIndex <= 0) {
      breakIndex = Math.min(availableWidth, remaining.length);
    }

    const segment = remaining.slice(0, breakIndex).trimEnd();
    wrapped.push(`${prefix}${segment}`);
    remaining = remaining.slice(breakIndex).trimStart();
    prefix = continuationPrefix;
  }

  if (remaining || wrapped.length === 0) {
    wrapped.push(`${prefix}${remaining}`);
  }

  return wrapped;
};

export const wrapTerminalText = (
  text: string,
  width = TERMINAL_TEXT_COLUMNS,
): string[] => {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((line) => wrapTerminalLine(line, width));
};

export const sendMessage = (
  text: string,
  role: "system" | "info" | "user" | "assistant" = "user", // default role is 'user'
): PrintableItem => {
  const wordClassName = `message-${role}`;
  const lineClassName = `line-${role}`;

  return sendMultiLine(
    wrapTerminalText(text).map((line) => ({
      words: [{ type: "text", characters: line, className: wordClassName }],
      options: { lineClassName },
    })),
  );
};

export const sendEmptyLine = (): PrintableItem => {
  return sendLine([{ type: "text", characters: "\u00A0" }]);
};

export const sendBorderedEmptyLine = (): PrintableItem => {
  return sendLine(
    [{ type: "text", characters: "\u00A0", className: "error-message" }],
    { lineClassName: "error-line" },
  );
};
