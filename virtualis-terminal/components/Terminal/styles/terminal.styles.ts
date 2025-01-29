// cogitatio-virtualis/virtualis-terminal/components/Terminal/styles/terminal.styles.ts

import {
  TerminalTheme,
  TerminalDimensions,
  TerminalConfig,
} from '../types/terminal';

export const DEFAULT_THEME: TerminalTheme = {
  background: '#0a0a0a',
  foreground: '#00ff00',
  primary: '#00ff00',
  secondary: '#00cc00',
  error: '#ff0000',
  warning: '#ffff00',
  success: '#00ff00',
  system: '#00ffff',
  dim: 'rgba(0, 255, 0, 0.5)',
  glow: 'rgba(0, 255, 0, 0.2)',
  info: '',
  highlight: '',
};

export const BASE_DIMENSIONS: TerminalDimensions = {
  width: '100%',
  height: '100%',
  maxWidth: '1024px',
  maxHeight: '768px',
  padding: '20px',
  borderRadius: '3.4285714286rem',
  margin: '',
};

export const ASPECT_RATIO = {
  width: 4,
  height: 3,
};

// Braille-based loading spinner frames
export const LOADING_FRAMES = [
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏',
] as const;

// Alternative spinners available for different effects
export const SPINNERS = {
  braille: LOADING_FRAMES,
  brailleLine: ['⠂', '⠄', '⠆', '⠇', '⠋', '⠙', '⠸', '⠰'],
  box: ['◜', '◠', '◝', '◞', '◡', '◟'],
  dots: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  detailedBraille: [
    '⠁',
    '⠁',
    '⠉',
    '⠙',
    '⠚',
    '⠒',
    '⠂',
    '⠂',
    '⠒',
    '⠲',
    '⠴',
    '⠤',
    '⠄',
    '⠄',
    '⠤',
    '⠠',
    '⠠',
    '⠤',
    '⠦',
    '⠖',
    '⠒',
    '⠐',
    '⠐',
    '⠒',
    '⠓',
    '⠋',
    '⠉',
    '⠈',
    '⠈',
  ],
} as const;

export const DEFAULT_CONFIG: TerminalConfig = {
  theme: DEFAULT_THEME,
  dimensions: BASE_DIMENSIONS,
  effects: {
    scanlines: true,
    noise: true,
    flicker: true,
    glow: true,
  },
  loader: {
    slides: [...LOADING_FRAMES],
    loaderSpeed: 80,
  },
  printer: {
    speed: 6,
    charactersPerTick: 2,
    pauseAfterPrint: 150,
    lineSpacing: 1.2,
  },
  settings: {
    historySize: 1000,
    scrollbackSize: 1000,
    cursorBlink: true,
    cursorStyle: 'block',
  },
};

export const EFFECTS = {
  scanlines: `
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        to bottom,
        transparent 50%,
        rgba(0, 0, 0, 0.05) 50%
      );
      background-size: 100% 4px;
      pointer-events: none;
      z-index: 1;
    }
  `,

  noise: `
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBAMAAADsEZWCAAAAGFBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAcXooUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAcSURBVDhPYwgNZRjKgBGEoKQDQzBUgYGBAQYAcL4HIX7iE0MAAAAASUVORK5CYII=');
      opacity: 0.02;
      pointer-events: none;
      animation: noise 0.2s steps(2) infinite;
      z-index: 2;
    }
  `,

  glow: `
    box-shadow: 
      0 0 10px rgba(0, 255, 0, 0.2),
      0 0 20px rgba(0, 255, 0, 0.1),
      0 0 30px rgba(0, 255, 0, 0.1);
  `,

  flicker: `
    animation: flicker 0.15s infinite;
  `,
};

export const ANIMATIONS = `
  @keyframes noise {
    0% { opacity: 0.02; }
    50% { opacity: 0.04; }
    100% { opacity: 0.02; }
  }

  @keyframes flicker {
    0% { opacity: 0.97; }
    50% { opacity: 1; }
    100% { opacity: 0.98; }
  }
`;

export const calculateDimensions = (
  containerWidth: number,
  containerHeight: number,
): TerminalDimensions => {
  let width: number;
  let height: number;

  const containerRatio = containerWidth / containerHeight;
  const targetRatio = ASPECT_RATIO.width / ASPECT_RATIO.height;

  if (containerRatio > targetRatio) {
    height = Math.min(containerHeight, parseInt(BASE_DIMENSIONS.maxHeight));
    width = height * targetRatio;
  } else {
    width = Math.min(containerWidth, parseInt(BASE_DIMENSIONS.maxWidth));
    height = width / targetRatio;
  }

  return {
    ...BASE_DIMENSIONS,
    width: `${width}px`,
    height: `${height}px`,
  };
};
