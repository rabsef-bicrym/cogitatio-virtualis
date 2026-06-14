import styles from "./MobileDenial.module.css";
import { COGITATIO_LOGO_TEXT } from "@/components/Terminal/config/ascii.config";
import Link from "next/link";

interface MobileDenialProps {
  canRotateToDesktop: boolean;
}

/**
 * Replaces the terminal on small screens with an intentional denial surface.
 */
export function MobileDenial({ canRotateToDesktop }: MobileDenialProps) {
  const heading = canRotateToDesktop
    ? "TRY YOUR DEVICE IN LANDSCAPE"
    : "TERMINAL REQUIRES LARGER DISPLAY";
  const body = canRotateToDesktop
    ? "Cogitatio Virtualis is a CRT-style terminal experience. It is best encountered on a larger landscape display, late at night, with the lights turned down. Your device is technically compatible in landscape. Try it, if you'd like."
    : "Cogitatio Virtualis is a CRT-style terminal experience. It is best encountered on a larger landscape display, late at night, with the lights turned down.";

  return (
    <main className={styles.stage} role="main">
      <div className={styles.panel}>
        <pre className={styles.logoFrame} aria-label="COGITATIO">
          {COGITATIO_LOGO_TEXT}
        </pre>

        <div className={styles.status}>
          <div className={styles.heading}>{heading}</div>
          <p className={styles.body}>{body}</p>
        </div>

        <div className={styles.actions}>
          <Link href="/resume">
            <span>View resume</span>
            <span className={styles.arrow}>-&gt;</span>
          </Link>
          <a
            href="https://github.com/rabsef-bicrym/cogitatio-virtualis"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>GitHub</span>
            <span className={styles.arrow}>-&gt;</span>
          </a>
          <a href="mailto:eric.helal@icloud.com">
            <span>Contact</span>
            <span className={styles.arrow}>-&gt;</span>
          </a>
        </div>

        <div className={styles.prompt} aria-hidden="true">
          cogitatio:~$
          <span className={styles.cursor} />
        </div>
      </div>
    </main>
  );
}
