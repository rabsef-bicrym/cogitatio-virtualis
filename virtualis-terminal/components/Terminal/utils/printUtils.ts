import {
  textLine,
  textWord,
  buttonWord,
  commandWord,
  anchorWord,
  PrintableItem,
  Words,
  Lines,
} from 'crt-terminal';

export { textWord, buttonWord, commandWord, anchorWord };
export type { PrintableItem, Words, Lines };

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

export type WordConfig = BaseWordConfig &
  (
    | { type: 'text' }
    | { type: 'button'; onClick: ButtonCallback }
    | { type: 'anchor'; href: string; onClick?: AnchorCallback }
    | { type: 'command'; prompt: string }
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
    case 'command':
      return commandWord({
        ...baseProps,
        prompt: config.prompt || '',
      });

    case 'button':
      return buttonWord({
        ...baseProps,
        onClick: config.onClick || (() => {}),
      });

    case 'anchor':
      return anchorWord({
        ...baseProps,
        href: config.href || '#',
        onClick: config.onClick,
      });

    case 'text':
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

export const sendMessage = (
  text: string,
  role: 'system' | 'info' | 'user' | 'assistant' = 'user', // default role is 'user'
): PrintableItem => {
  const wordClassName = `message-${role}`;
  const lineClassName = `line-${role}`;

  return sendLine(
    [{ type: 'text', characters: text, className: wordClassName }],
    { lineClassName },
  );
};

export const sendEmptyLine = (): PrintableItem => {
  return sendLine([{ type: 'text', characters: '\u00A0' }]);
};

export const sendBorderedEmptyLine = (): PrintableItem => {
  return sendLine(
    [{ type: 'text', characters: '\u00A0', className: 'error-message' }],
    { lineClassName: 'error-line' },
  );
};
