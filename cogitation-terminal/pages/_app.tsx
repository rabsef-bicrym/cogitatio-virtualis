// cogitatio-virtualis/cogitation-terminal/pages/_app.tsx
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import '../styles/globals.css'

function preventZoom(e: TouchEvent) {
  // Prevent pinch zoom
  if (e.touches.length > 1) {
    e.preventDefault()
  }
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Add touch event listeners for mobile
    document.addEventListener('touchmove', preventZoom, { passive: false })
    
    // Remove event listeners on cleanup
    return () => {
      document.removeEventListener('touchmove', preventZoom)
    }
  }, [])

  return (
    <>
      <Component {...pageProps} />
      <style jsx global>{`
        /* Additional global styles that need to be loaded after globals.css */
        @media (max-width: 768px) {
          .terminal-frame {
            border-radius: 0;
            width: 100vw;
            height: 100vh;
          }
        }

        /* Ensure proper CRT effect on high-DPI displays */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
          .terminal-frame::before {
            background-size: 100% 2px;
          }
        }

        /* Prevent text selection during animations */
        .ascii-line {
          user-select: none;
        }

        /* Allow text selection after boot sequence */
        .terminal-ready .ascii-line {
          user-select: text;
        }
      `}</style>
    </>
  )
}