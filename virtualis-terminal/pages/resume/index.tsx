import Head from "next/head";

export default function PDFPage() {
  const printPDF = () => {
    const pdfWindow = window.open("/resume.pdf", "_blank");
    if (pdfWindow) {
      setTimeout(() => {
        pdfWindow.print();
      }, 500);
    }
  };

  const openPDF = () => {
    window.open("/resume.pdf", "_blank", "noopener");
  };

  const closeWindow = () => {
    window.close();
  };

  return (
    <>
      <Head>
        <title>Resume Viewer - Cogitatio Virtualis</title>
      </Head>

      <main className="resume-kiosk" aria-label="Cogitatio resume viewer">
        <div className="resume-room" aria-hidden="true">
          <div className="resume-rim" />
          <div className="resume-blinds" />
          <div className="resume-floor" />
        </div>

        <section className="resume-machine">
          <header className="resume-header">
            <div className="resume-brand">
              <span className="resume-stamp">COGITATIO VIRTUALIS</span>
              <span className="resume-substamp">RESUME VIEWER / CV-1 AUX</span>
            </div>
            <nav className="resume-actions" aria-label="Resume actions">
              <button
                onClick={printPDF}
                className="resume-button"
                type="button"
              >
                PRINT
              </button>
              <button onClick={openPDF} className="resume-button" type="button">
                OPEN PDF
              </button>
              <button
                onClick={closeWindow}
                className="resume-button"
                type="button"
              >
                EXIT
              </button>
            </nav>
          </header>

          <div className="resume-document">
            <embed
              src="/resume.pdf#toolbar=0&navpanes=0&scrollbar=0"
              type="application/pdf"
              className="resume-viewer"
            />
            <div className="resume-glass" aria-hidden="true" />
            <div className="resume-scanlines" aria-hidden="true" />
            <div className="resume-vignette" aria-hidden="true" />
          </div>
        </section>
      </main>

      <style jsx>{`
        .resume-kiosk {
          position: fixed;
          inset: 0;
          overflow: hidden;
          display: grid;
          place-items: center;
          padding: 18px;
          color: #c7ffc9;
          background:
            radial-gradient(
              90% 70% at 88% 14%,
              rgba(255, 165, 80, 0.18),
              transparent 45%
            ),
            linear-gradient(180deg, #050403 0%, #100b07 58%, #1a120a 100%);
        }

        .resume-room,
        .resume-rim,
        .resume-blinds,
        .resume-floor {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .resume-room {
          overflow: hidden;
        }

        .resume-rim {
          background: radial-gradient(
            60% 60% at 100% 20%,
            rgba(255, 160, 70, 0.28),
            transparent 62%
          );
          filter: blur(34px);
          mix-blend-mode: screen;
        }

        .resume-blinds {
          inset: -10%;
          opacity: 0.42;
          background:
            linear-gradient(
              90deg,
              transparent 0%,
              transparent calc(18% - 1px),
              rgba(0, 0, 0, 0.5) 18%,
              rgba(0, 0, 0, 0.5) calc(18% + 1px),
              transparent calc(18% + 2px)
            ),
            repeating-linear-gradient(
              179deg,
              transparent 0,
              transparent 14px,
              rgba(0, 0, 0, 0.35) 16px,
              rgba(0, 0, 0, 0.35) 26px,
              transparent 28px
            );
          transform: matrix3d(
            0.88,
            -0.04,
            0,
            0.0006,
            0,
            1,
            0,
            0,
            0,
            0,
            1,
            0,
            0,
            0,
            0,
            1
          );
          transform-origin: top right;
          mix-blend-mode: multiply;
        }

        .resume-floor {
          top: auto;
          height: 34%;
          background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.62));
        }

        .resume-machine {
          position: relative;
          z-index: 1;
          width: min(100%, 1160px);
          height: min(100%, 820px);
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 12px;
          padding: 14px;
          border: 1px solid rgba(0, 0, 0, 0.75);
          border-radius: 5px;
          background:
            radial-gradient(90% 60% at 25% 0%, #2c2520, transparent 60%),
            radial-gradient(60% 40% at 80% 100%, #100d0a, transparent 70%),
            #1d1814;
          box-shadow:
            0 30px 60px rgba(0, 0, 0, 0.78),
            inset 0 1px 0 rgba(255, 195, 130, 0.28),
            inset 0 -2px 0 rgba(0, 0, 0, 0.7),
            inset 4px 0 12px rgba(0, 0, 0, 0.45),
            inset -4px 0 12px rgba(0, 0, 0, 0.55);
        }

        .resume-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 4px 4px 12px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.58);
          box-shadow: inset 0 -1px 0 rgba(255, 195, 130, 0.16);
        }

        .resume-brand {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .resume-stamp,
        .resume-substamp,
        .resume-button {
          font-family: "Courier New", courier, monospace;
          color: #7a6e60;
          text-shadow:
            0 1px 0 rgba(255, 195, 130, 0.28),
            0 -1px 0 rgba(0, 0, 0, 0.55);
        }

        .resume-stamp {
          font-size: 12px;
          font-weight: 800;
        }

        .resume-substamp {
          font-size: 9px;
          color: rgba(140, 130, 120, 0.62);
        }

        .resume-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .resume-button {
          min-height: 32px;
          padding: 0 12px;
          border: 1px solid rgba(0, 0, 0, 0.82);
          border-radius: 2px;
          background: linear-gradient(180deg, #14110d 0%, #050402 100%);
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.06),
            inset 0 -1px 2px rgba(0, 0, 0, 0.7);
        }

        .resume-button:hover,
        .resume-button:focus-visible {
          color: #b8ffbb;
          outline: none;
          box-shadow:
            0 0 8px rgba(57, 255, 90, 0.28),
            inset 0 1px 1px rgba(255, 255, 255, 0.08),
            inset 0 -1px 2px rgba(0, 0, 0, 0.7);
        }

        .resume-button:active {
          transform: translateY(1px);
        }

        .resume-document {
          position: relative;
          overflow: hidden;
          min-height: 0;
          border-radius: 18px / 22px;
          background: #040805;
          isolation: isolate;
          box-shadow:
            inset 0 0 0 2px #050504,
            inset 0 0 0 4px rgba(20, 18, 14, 0.95),
            inset 0 0 0 5px rgba(0, 0, 0, 0.95),
            0 0 0 1px rgba(0, 0, 0, 0.85);
        }

        .resume-viewer {
          position: absolute;
          inset: 10px;
          z-index: 1;
          width: calc(100% - 20px);
          height: calc(100% - 20px);
          border: 0;
          border-radius: 10px / 12px;
          background: #0b0c08;
        }

        .resume-glass,
        .resume-scanlines,
        .resume-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .resume-glass {
          z-index: 2;
          background:
            radial-gradient(
              50% 45% at 84% 10%,
              rgba(255, 175, 100, 0.12),
              transparent 70%
            ),
            radial-gradient(
              60% 50% at 18% 12%,
              rgba(255, 255, 255, 0.05),
              transparent 62%
            );
          mix-blend-mode: screen;
        }

        .resume-scanlines {
          z-index: 3;
          opacity: 0.22;
          background: repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent 2px,
            rgba(0, 0, 0, 0.32) 3px,
            transparent 4px
          );
          mix-blend-mode: multiply;
        }

        .resume-vignette {
          z-index: 4;
          box-shadow:
            inset 0 0 60px 14px rgba(0, 0, 0, 0.72),
            inset 0 0 180px 50px rgba(0, 0, 0, 0.38);
        }

        @media (max-width: 720px) {
          .resume-kiosk {
            padding: 10px;
          }

          .resume-machine {
            height: 100%;
            padding: 10px;
          }

          .resume-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .resume-actions {
            width: 100%;
            justify-content: space-between;
          }

          .resume-button {
            flex: 1 1 auto;
            padding: 0 8px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .resume-button:active {
            transform: none;
          }
        }
      `}</style>
    </>
  );
}
