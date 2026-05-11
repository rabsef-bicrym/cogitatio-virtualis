// cogitatio-virtualis/virtualis-terminal/pages/index.tsx

import { useEffect, useState } from "react";
import Head from "next/head";
import { MobileDenial } from "@/components/MobileDenial/MobileDenial";
import { RoomScene } from "@/components/RoomScene/RoomScene";
import { VirtualisTerminal } from "@/components/Terminal/VirtualisTerminal";

const MIN_DESKTOP_WIDTH = 900;
const MIN_DESKTOP_HEIGHT = 650;
const DESKTOP_EXPERIENCE_QUERY = `(min-width: ${MIN_DESKTOP_WIDTH}px) and (min-height: ${MIN_DESKTOP_HEIGHT}px)`;

interface ExperienceState {
  isDesktop: boolean;
  canRotateToDesktop: boolean;
}

/**
 * Tracks the viewport class that decides which experience should mount.
 */
function useDesktopExperience(): ExperienceState | null {
  const [experience, setExperience] = useState<ExperienceState | null>(null);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_EXPERIENCE_QUERY);
    const update = () => {
      const { innerWidth, innerHeight } = window;
      const canRotateToDesktop =
        innerWidth < innerHeight &&
        innerHeight >= MIN_DESKTOP_WIDTH &&
        innerWidth >= MIN_DESKTOP_HEIGHT;

      setExperience({
        isDesktop: query.matches,
        canRotateToDesktop,
      });
    };

    update();
    query.addEventListener("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      query.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return experience;
}

export default function Home() {
  const experience = useDesktopExperience();

  return (
    <>
      <Head>
        <title>COGITATIO VIRTUALIS</title>
        <meta
          name="description"
          content="Neural Interface for Legal Knowledge"
        />
      </Head>

      <main className="home-shell">
        <div className="desktop-experience">
          {experience?.isDesktop ? (
            <RoomScene>
              <VirtualisTerminal />
            </RoomScene>
          ) : null}
        </div>
        <div className="mobile-experience">
          {experience?.isDesktop === false ? (
            <MobileDenial canRotateToDesktop={experience.canRotateToDesktop} />
          ) : null}
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

        @media (max-width: ${MIN_DESKTOP_WIDTH - 1}px),
          (max-height: ${MIN_DESKTOP_HEIGHT - 1}px) {
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
