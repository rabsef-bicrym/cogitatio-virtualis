import styles from "./MobileDenial.module.css";
import { COGITATIO_LOGO_TEXT } from "@/components/Terminal/config/ascii.config";
import Link from "next/link";

/**
 * Replaces the terminal on small screens with an intentional denial surface.
 */
export function MobileDenial() {
  return (
    <main className={styles.stage} role="main">
      <div className={styles.panel}>
        <pre className={styles.logoFrame} aria-label="COGITATIO">
          {COGITATIO_LOGO_TEXT}
        </pre>

        <div className={styles.status}>
          <div className={styles.heading}>TERMINAL REQUIRES LARGER DISPLAY</div>
          <p className={styles.body}>
            Cogitatio Virtualis is a CRT-style terminal experience. It is best
            encountered on a desktop browser, late at night, with the lights
            turned down.
          </p>
          <div className={styles.hint}>
            Open this address on a computer to begin.
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/resume">
            <span>View resume</span>
            <span className={styles.arrow}>-&gt;</span>
          </Link>
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
