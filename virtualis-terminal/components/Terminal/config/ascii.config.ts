// cogitatio-virtualis/virtualis-terminal/components/Terminal/config/ascii.config.ts

import {
  WordConfig,
  LineOptions,
} from '@/components/Terminal/utils/printUtils'; // Adjust the import path as necessary

const COGITATIO_LOGO = [
  '▄████▄   ▒█████    ▄████  ██▓▄▄▄█████▓ ▄▄▄     ▄▄▄█████▓ ██▓ ▒█████  ',
  '▒██▀ ▀█  ▒██▒  ██▒ ██▒ ▀█▒▓██▒▓  ██▒ ▓▒▒████▄   ▓  ██▒ ▓▒▓██▒▒██▒  ██▒',
  '▒▓█    ▄ ▒██░  ██▒▒██░▄▄▄░▒██▒▒ ▓██░ ▒░▒██  ▀█▄ ▒ ▓██░ ▒░▒██▒▒██░  ██▒',
  '▒▓▓▄ ▄██▒▒██   ██░░▓█  ██▓░██░░ ▓██▓ ░ ░██▄▄▄▄██░ ▓██▓ ░ ░██░▒██   ██░',
  '▒ ▓███▀ ░░ ████▓▒░░▒▓███▀▒░██░  ▒██▒ ░  ▓█   ▓██▒ ▒██▒ ░ ░██░░ ████▓▒░',
  '░ ░▒ ▒  ░░ ▒░▒░▒░  ░▒   ▒ ░▓    ▒ ░░    ▒▒   ▓▒█░ ▒ ░░   ░▓  ░ ▒░▒░▒░ ',
  '  ░  ▒     ░ ▒ ▒░   ░   ░  ▒ ░    ░      ▒   ▒▒ ░   ░     ▒ ░  ░ ▒ ▒░ ',
  '░        ░ ░ ░ ▒  ░ ░   ░  ▒ ░  ░        ░   ▒    ░       ▒ ░░ ░ ░ ▒  ',
  '░ ░          ░ ░        ░  ░                 ░  ░         ░      ░ ░  ',
  '                                                                      ',
];

export const COGITATIO_LOGO_LINES = COGITATIO_LOGO.map((line) => ({
  words: [
    {
      type: 'text',
      characters: line,
      className: 'ascii-char',
    } as WordConfig,
  ],
  options: { lineClassName: 'ascii-line' } as LineOptions,
}));

export const ASCII_ERROR = [
  '  _________  ',
  " |'---+---'| ",
  ' || ◕  ◕ || ',
  ' || .---. || ',
  ' `--[ - ]--` ',
  ' __|==|==|__ ',
  '|:::::::::::|',
  '`-=-=-=-=-=-`',
];

// Transform into format for utils
export const ASCII_ERROR_LINES = ASCII_ERROR.map((line) => ({
  words: [
    {
      type: 'text' as const,
      characters: line,
      className: 'error-message',
    } as WordConfig,
  ],
  options: { lineClassName: 'error-line' } as LineOptions,
}));

export interface ASCIILine {
  text: string;
  delay: number;
}

export const ANIMATION_DELAYS = {
  CHAR_FADE_IN: 50,
  LINE_FADE_IN: 100,
  FULL_LOGO_DISPLAY: 1500,
};

// Consolidated styles
export const ASCII_STYLES = `
  .ascii-container {
    position: relative;
    white-space: pre;
    font-family: monospace;
    line-height: 1.2;
    padding: 20px;
    color: var(--terminal-green);
  }

  .ascii-line {
    position: relative;
    display: block;
    opacity: 0;
    height: 1.2em;
    animation: fadeInLine 0.5s ease-in forwards;
    animation-play-state: running;
  }

  .ascii-line-animated {
    animation: asciiGlowPulse 2s infinite;
  }

  .ascii-char {
    display: inline-block;
    opacity: 0;
    animation: asciiGlowChar 0.5s ease-out forwards;
    text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
  }

  @keyframes fadeInLine {
    0% {
      opacity: 0;
      transform: translateY(-2px);
      text-shadow: 0 0 5px var(--terminal-green-dim);
    }
    50% {
      opacity: 0.5;
      text-shadow: 0 0 10px var(--terminal-green);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
      text-shadow: 0 0 5px var(--terminal-green-dim);
    }
  }

  @keyframes asciiGlowChar {
    0% {
      opacity: 0;
      transform: scale(1.5);
      filter: blur(4px);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
      filter: blur(2px);
    }
    100% {
      opacity: 1;
      transform: scale(1);
      filter: blur(0);
    }
  }

  @keyframes asciiGlowPulse {
    0% { text-shadow: 0 0 5px var(--terminal-green-dim); }
    50% { text-shadow: 0 0 15px var(--terminal-green); }
    100% { text-shadow: 0 0 5px var(--terminal-green-dim); }
  }
`;
