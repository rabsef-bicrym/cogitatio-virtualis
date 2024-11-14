// cogitatio-virtualis/cogitation-terminal/pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="Cogitation Terminal - Neural Interface for Legal Knowledge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Critical CRT effects - loaded immediately */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes scanline {
            0% {
              transform: translateY(-100%);
            }
            100% {
              transform: translateY(100%);
            }
          }
          
          @keyframes flicker {
            0% { opacity: 0.97; }
            50% { opacity: 1; }
            100% { opacity: 0.98; }
          }
          
          @keyframes noise {
            0%, 100% { background-position: 0 0; }
            10% { background-position: -5% -10%; }
            20% { background-position: -15% 5%; }
            30% { background-position: 7% -25%; }
            40% { background-position: 20% 25%; }
            50% { background-position: -25% 10%; }
            60% { background-position: 15% 5%; }
            70% { background-position: 0% 15%; }
            80% { background-position: 25% 35%; }
            90% { background-position: -10% 10%; }
          }

          .terminal-frame {
            position: relative;
            overflow: hidden;
            background: var(--background);
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.2);
          }
          
          .terminal-frame::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
              180deg,
              transparent 0%,
              rgba(0, 255, 0, 0.05) 50%,
              transparent 100%
            );
            animation: scanline 8s linear infinite;
            pointer-events: none;
          }

          .terminal-frame::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBAMAAADsEZWCAAAAGFBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAcXooUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAcSURBVDhPYwgNZRjKgBGEoKQDQzBUgYGBAQYAcL4HIX7iE0MAAAAASUVORK5CYII=');
            opacity: 0.02;
            animation: noise 0.2s infinite;
            pointer-events: none;
          }
          
          /* Ensure terminal text remains sharp */
          * {
            -webkit-font-smoothing: none;
            -moz-osx-font-smoothing: grayscale;
          }
        ` }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}