// cogitatio-virtualis/virtualis-terminal/pages/index.tsx

import { useEffect, useState } from "react";
import Head from "next/head";
import { MobileDenial } from "@/components/MobileDenial/MobileDenial";
import { RoomScene } from "@/components/RoomScene/RoomScene";
import { VirtualisTerminal } from "@/components/Terminal/VirtualisTerminal";

/**
 * Tracks the viewport class that decides which experience should mount.
 */
function useDesktopExperience(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 769px)");
    const update = () => setIsDesktop(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export default function Home() {
  const isDesktop = useDesktopExperience();

  return (
    <>
      <Head>
        <title>COGITATIO VIRTUALIS</title>
        <meta
          name="description"
          content="Neural Interface for Legal Knowledge"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="home-shell">
        <div className="desktop-experience">
          {isDesktop ? (
            <RoomScene>
              <VirtualisTerminal />
            </RoomScene>
          ) : null}
        </div>
        <div className="mobile-experience">
          {isDesktop === false ? <MobileDenial /> : null}
        </div>
      </main>

      <style jsx>{`
        .home-shell {
          width: 100vw;
          min-height: 100vh;
          background: var(--background);
        }

        .desktop-experience {
          display: block;
        }

        .mobile-experience {
          display: none;
        }

        @media (max-width: 768px) {
          .desktop-experience {
            display: none;
          }

          .mobile-experience {
            display: block;
          }
        }
      `}</style>
    </>
  );
}
