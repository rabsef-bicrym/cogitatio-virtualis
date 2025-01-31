// cogitatio-virtualis/virtualis-terminal/components/Terminal/TerminalFrame.tsx

import React, { useEffect, useRef, useState } from 'react';
import type { TerminalConfig } from './types/terminal';

interface TerminalFrameProps {
  children: React.ReactNode;
  className?: string;
  config: TerminalConfig;
}

const ASPECT_RATIO = {
  width: 4,
  height: 3,
};

// Added constant for bottom bezel height
const BOTTOM_BEZEL_HEIGHT = 30; // px

export const TerminalFrame: React.FC<TerminalFrameProps> = ({
  children,
  className,
  config,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isLandscape, setIsLandscape] = useState(false);

  const handleButtonClick = (buttonName: string) => {
    console.log(`Button clicked: ${buttonName}`);

    switch (buttonName) {
      case 'Resume': {
        window.open('/resume', '_blank', 'popup,width=800,height=600');
        break;
      }
      case 'GitHub': {
        window
          .open(
            'https://github.com/rabsef-bicrym/cogitatio-virtualis',
            '_blank',
            'noopener',
          )
          ?.focus();
        break;
      }
      case 'Contact': {
        window.location.href =
          'mailto:eric.helal@icloud.com?subject=' +
          encodeURIComponent(
            'Ref Cog.Vit: Hi Eric - Are you available for an interview?',
          );
        break;
      }
    }
  };

  useEffect(() => {
    const calculateDimensions = () => {
      if (!containerRef.current) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isLandscapeMode = viewportWidth > viewportHeight;
      setIsLandscape(isLandscapeMode);

      if (viewportWidth <= 768) {
        setDimensions({
          width: viewportWidth,
          height: viewportHeight,
        });
      } else {
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        const containerRatio = containerWidth / containerHeight;
        const targetRatio = ASPECT_RATIO.width / ASPECT_RATIO.height;

        let width, height;

        if (containerRatio > targetRatio) {
          height = Math.min(
            containerHeight,
            parseInt(config.dimensions.maxHeight),
          );
          width = height * targetRatio;
        } else {
          width = Math.min(
            containerWidth,
            parseInt(config.dimensions.maxWidth),
          );
          height = width / targetRatio;
        }

        setDimensions({ width, height });
      }
    };

    calculateDimensions();
    window.addEventListener('resize', calculateDimensions);
    window.addEventListener('orientationchange', calculateDimensions);

    return () => {
      window.removeEventListener('resize', calculateDimensions);
      window.removeEventListener('orientationchange', calculateDimensions);
    };
  }, [config.dimensions]);

  return (
    <div className='terminal-frame-container' ref={containerRef}>
      <div
        className={`terminal-frame ${className || ''} ${
          isLandscape ? 'landscape' : 'portrait'
        }`}
        style={{
          width: dimensions.width ? `${dimensions.width}px` : '100%',
          height: dimensions.height ? `${dimensions.height}px` : '100%',
        }}
      >
        <div className='content-area'>{children}</div>

        <div className='bezel-buttons'>
          <button
            className='bezel-button'
            onClick={() => handleButtonClick('Resume')}
          >
            Resume
          </button>
          <button
            className='bezel-button'
            onClick={() => handleButtonClick('GitHub')}
          >
            GitHub
          </button>
          <button
            className='bezel-button'
            onClick={() => handleButtonClick('Contact')}
          >
            Contact
          </button>
        </div>
      </div>

      <style jsx>{`
        .terminal-frame-container {
          width: 100%;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${config.theme.background};
          overflow: hidden;
        }

        .terminal-frame {
          position: relative;
          background: ${config.theme.background};
          color: ${config.theme.foreground};
          overflow: hidden;
          transition:
            width 0.3s ease,
            height 0.3s ease;
          box-shadow: 0 0 10px ${config.theme.glow};
          border-radius: 12px;
          padding-bottom: ${BOTTOM_BEZEL_HEIGHT}px; /* Extended bottom padding */

          /* Desktop styles */
          @media (min-width: 1025px) {
            padding: 20px 20px ${BOTTOM_BEZEL_HEIGHT}px 20px;
          }

          /* Mobile and tablet styles */
          @media (max-width: 1024px) {
            padding: 10px;
            border-radius: 0;
            width: 100vw !important;
            height: 100vh !important;
          }
        }

        .content-area {
          height: 100%;
          overflow: hidden;
          border-radius: 8px;
        }

        .bezel-buttons {
          position: absolute;
          top: 0.5px
          bottom: 5px;  /* Positioned within the extended bottom bezel */
          left: 0;
          right: 0;
          height: 32px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 24px;
          padding: 0 16px;
          background: transparent;
          pointer-events: auto;
        }

        .bezel-button {
          background: transparent;
          border: 1px solid rgba(100, 100, 100, 0.3);
          border-radius: 2px;
          color: rgba(160, 160, 160, 0.7);
          padding: 4px 12px;
          font-size: 12px;
          font-family: monospace;
          cursor: pointer;
          transition: all 0.2s ease;
          text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
        }

        .bezel-button:hover {
          color: rgba(200, 200, 200, 0.9);
          border-color: rgba(140, 140, 140, 0.5);
        }

        .bezel-button:active {
          color: rgba(220, 220, 220, 1);
          transform: translateY(1px);
        }

        /* CRT effects when enabled */
        ${
          config.effects.scanlines
            ? `
          .content-area::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: ${BOTTOM_BEZEL_HEIGHT}px;
            background: linear-gradient(
              to bottom,
              transparent 50%,
              rgba(0, 0, 0, 0.05) 50%
            );
            background-size: 100% 4px;
            pointer-events: none;
            z-index: 1;
          }
        `
            : ''
        }

        ${
          config.effects.noise
            ? `
          .content-area::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: ${BOTTOM_BEZEL_HEIGHT}px;
            background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBAMAAADsEZWCAAAAGFBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAcXooUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAcSURBVDhPYwgNZRjKgBGEoKQDQzBUgYGBAQYAcL4HIX7iE0MAAAAASUVORK5CYII=');
            opacity: 0.02;
            pointer-events: none;
            z-index: 2;
            animation: noise 0.2s infinite;
          }
        `
            : ''
        }

        /* Ensure content is above effects but buttons can still be clicked */
        .terminal-frame > * {
          position: relative;
          z-index: 3;
        }

        @keyframes noise {
          0% { transform: translate(0, 0); }
          10% { transform: translate(-1%, -1%); }
          20% { transform: translate(1%, 1%); }
          30% { transform: translate(-1%, 1%); }
          40% { transform: translate(1%, -1%); }
          50% { transform: translate(-1%, -1%); }
          60% { transform: translate(1%, 1%); }
          70% { transform: translate(-1%, 1%); }
          80% { transform: translate(1%, -1%); }
          90% { transform: translate(-1%, -1%); }
          100% { transform: translate(0, 0); }
        }

        /* Portrait warning for mobile */
        @media (max-width: 1024px) and (orientation: portrait) {
          .terminal-frame::before {
            content: 'Please rotate your device';
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: ${config.theme.warning};
            padding: 20px;
            font-size: 1.5rem;
            text-align: center;
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
            pointer-events: none;
            animation: jitter 0.1s infinite alternate;
          }
        }

        @keyframes jitter {
          0% {
            transform: translate(-50%, -50%) translateX(-1px) translateY(-1px);
          }
          100% {
            transform: translate(-50%, -50%) translateX(1px) translateY(1px);
          }
        }
      `}</style>
    </div>
  );
};

export default TerminalFrame;
