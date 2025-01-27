// cogitatio-virtualis/cogitatio-terminal/pages/index.tsx
import React from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { CogitationTerminal } from '@/components/Terminal/CogitationTerminal';



export default function Home() {
  return (
    <>
      <Head>
        <title>COGITATIO VIRTUALIS</title>
        <meta name="description" content="Neural Interface for Legal Knowledge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="terminal-container">
        <CogitationTerminal />
      </main>

      <style jsx>{`
        .terminal-container {
          width: 100vw;
          height: 100vh;
          background: var(--background);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          
          @media (max-width: 768px) {
            padding: 0;
          }
        }
      `}</style>
    </>
  );
}