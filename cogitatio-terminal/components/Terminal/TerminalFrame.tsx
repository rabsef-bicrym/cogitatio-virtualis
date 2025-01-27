// cogitatio-virtualis/cogitatio-terminal/components/Terminal/TerminalFrame.tsx

import React, { useEffect, useRef, useState } from 'react';
import type { TerminalConfig } from './types/terminal';

interface TerminalFrameProps {
  children: React.ReactNode;
  className?: string;
  config: TerminalConfig;
}

// Constants for aspect ratio
const ASPECT_RATIO = {
  width: 4,
  height: 3,
};

export const TerminalFrame: React.FC<TerminalFrameProps> = ({
  children,
  className,
  config,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const calculateDimensions = () => {
      if (!containerRef.current) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isLandscapeMode = viewportWidth > viewportHeight;
      setIsLandscape(isLandscapeMode);

      if (viewportWidth <= 768) {
        // Mobile breakpoint
        // On mobile, we take up the full screen
        setDimensions({
          width: viewportWidth,
          height: viewportHeight,
        });
      } else {
        // On desktop, maintain 4:3 aspect ratio within bounds
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        const containerRatio = containerWidth / containerHeight;
        const targetRatio = ASPECT_RATIO.width / ASPECT_RATIO.height;

        let width, height;

        if (containerRatio > targetRatio) {
          // Container is wider than needed
          height = Math.min(
            containerHeight,
            parseInt(config.dimensions.maxHeight),
          );
          width = height * targetRatio;
        } else {
          // Container is taller than needed
          width = Math.min(
            containerWidth,
            parseInt(config.dimensions.maxWidth),
          );
          height = width / targetRatio;
        }

        setDimensions({ width, height });
      }
    };

    // Initial calculation
    calculateDimensions();

    // Recalculate on resize and orientation change
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
        {children}
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

          /* Desktop styles */
          @media (min-width: 1025px) {
            // updated from 769px
            border-radius: 8px;
            padding: ${config.dimensions.padding};
          }

          /* Mobile and tablet styles */
          @media (max-width: 1024px) {
            // updated from 768px
            padding: 10px;
            border-radius: 0;
            width: 100vw !important;
            height: 100vh !important;
          }

          /* CRT effects when enabled */
          ${config.effects.scanlines
            ? `
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
          `
            : ''}

          ${config.effects.noise
            ? `
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
              z-index: 2;
              animation: noise 0.2s infinite;
            }
          `
            : ''}
        }

        /* Ensure content is above effects */
        .terminal-frame > * {
          position: relative;
          z-index: 3;
        }

        @keyframes noise {
          0% {
            transform: translate(0, 0);
          }
          10% {
            transform: translate(-1%, -1%);
          }
          20% {
            transform: translate(1%, 1%);
          }
          30% {
            transform: translate(-1%, 1%);
          }
          40% {
            transform: translate(1%, -1%);
          }
          50% {
            transform: translate(-1%, -1%);
          }
          60% {
            transform: translate(1%, 1%);
          }
          70% {
            transform: translate(-1%, 1%);
          }
          80% {
            transform: translate(1%, -1%);
          }
          90% {
            transform: translate(-1%, -1%);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        /* Portrait warning for mobile */
        @media (max-width: 1024px) and (orientation: portrait) {
          .terminal-frame::before {
            content: 'Please rotate your device';
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8); /* Semi-transparent overlay */
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
            backdrop-filter: blur(5px); /* Blur effect */
            pointer-events: none; /* Disable interaction */

            /* Slight jitter animation */
            animation: jitter 0.1s infinite alternate;
          }
        }

        /* Jitter keyframes */
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
