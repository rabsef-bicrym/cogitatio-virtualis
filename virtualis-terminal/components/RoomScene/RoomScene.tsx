import type { CSSProperties, ReactNode } from "react";
import { CrtScreenEffects } from "./CrtScreenEffects";
import { useCarPasses } from "./useCarPasses";
import { usePedestrianPasses } from "./usePedestrianPasses";

interface RoomSceneProps {
  children: ReactNode;
}

interface PedestrianSilhouetteProps {
  figNum: number;
  flip: boolean;
}

function actionFor(label: string): void {
  switch (label) {
    case "RESUME":
      window.open("/resume", "_blank", "popup,width=800,height=600");
      break;
    case "GITHUB":
      window.open(
        "https://github.com/rabsef-bicrym/cogitatio-virtualis",
        "_blank",
        "noopener",
      );
      break;
    case "CONTACT":
      window.location.href =
        "mailto:eric.helal@icloud.com?subject=" +
        encodeURIComponent(
          "Ref Cog.Vit: Hi Eric - Are you available for an interview?",
        );
      break;
  }
}

function PedestrianSilhouette({ figNum, flip }: PedestrianSilhouetteProps) {
  const src = `/room/ped-${String(figNum).padStart(2, "0")}.png`;

  return (
    <div
      className={`tk-ped-figure ${flip ? "tk-ped-figure-flip" : ""}`}
      style={{ "--ped-image": `url(${src})` } as CSSProperties}
    />
  );
}

function Toggle({ label }: { label: string }) {
  return (
    <button
      className="tk-toggle"
      type="button"
      onClick={() => actionFor(label)}
    >
      <span className="tk-toggle-engraved">{label}</span>
      <span className="tk-toggle-body" aria-hidden="true">
        <span className="tk-toggle-lever" />
      </span>
      <span className="tk-toggle-led" aria-hidden="true" />
    </button>
  );
}

/**
 * Renders the desktop room, monitor housing, and unified tube effects.
 */
export function RoomScene({ children }: RoomSceneProps) {
  const carEvent = useCarPasses();
  const pedEvent = usePedestrianPasses();
  const stageStyle = carEvent
    ? ({
        "--car-speed": `${carEvent.speed}s`,
        "--car-color": carEvent.color,
      } as CSSProperties)
    : undefined;

  return (
    <section
      className={`tk-stage tk-nocturne ${carEvent ? "tk-stage-pass" : ""} ${
        pedEvent ? "tk-stage-ped" : ""
      }`}
      style={stageStyle}
      aria-label="Cogitatio Virtualis terminal room"
    >
      <div className="tk-room" aria-hidden="true">
        <div className="tk-rim" />
        <div className="tk-streetlight" />
        <div className="tk-blinds-perspective">
          <div className="tk-blinds" />
        </div>
        <div className="tk-floor" />
        {carEvent ? (
          <div
            key={carEvent.id}
            className={`tk-carpass tk-carpass-${carEvent.dir}`}
            style={
              {
                "--car-color": carEvent.color,
                "--car-speed": `${carEvent.speed}s`,
              } as CSSProperties
            }
          />
        ) : null}
        {pedEvent ? (
          <div
            key={pedEvent.id}
            className={`tk-ped tk-ped-${pedEvent.dir} ${
              pedEvent.isCouple ? "tk-ped-couple" : ""
            }`}
            style={
              {
                "--ped-speed": `${pedEvent.speed}s`,
                "--ped-scale": pedEvent.scale,
              } as CSSProperties
            }
          >
            <PedestrianSilhouette
              figNum={pedEvent.figA}
              flip={pedEvent.flipA}
            />
            {pedEvent.isCouple ? (
              <PedestrianSilhouette
                figNum={pedEvent.figB}
                flip={pedEvent.flipB}
              />
            ) : null}
          </div>
        ) : null}
        <div className="tk-progressive-blur" aria-hidden="true">
          <div />
          <div />
          <div />
        </div>
        <div className="tk-motes" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, index) => {
            const big = index % 5 === 0;
            return (
              <span
                key={index}
                style={{
                  left: `${(index * 53) % 100}%`,
                  top: `${((index * 37) % 80) - 10}%`,
                  animationDelay: `${(index * 0.9) % 16}s`,
                  animationDuration: `${16 + (index % 6)}s`,
                  width: big ? "4px" : "2px",
                  height: big ? "4px" : "2px",
                }}
              />
            );
          })}
        </div>
        <div className="tk-horizon" />
      </div>

      <div className="tk-monitor">
        <div className="tk-highlight" aria-hidden="true" />
        <div className="tk-yellow" aria-hidden="true" />
        <div className="tk-monitor-litside" aria-hidden="true" />
        <div
          className="tk-monitor-headlight"
          aria-hidden="true"
          style={
            carEvent ? ({ "--car-color": carEvent.color } as CSSProperties) : {}
          }
        />
        <div className="tk-dust tk-dust-tl" aria-hidden="true" />
        <div className="tk-dust tk-dust-tr" aria-hidden="true" />

        <div className="tk-row">
          <div className="tk-vent" aria-hidden="true">
            {Array.from({ length: 22 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
          <div className="tk-glass">
            <div className="tk-glass-inner">
              <div className="tk-glass-content">{children}</div>
              <CrtScreenEffects carColor={carEvent?.color} />
            </div>
          </div>
          <div className="tk-vent" aria-hidden="true">
            {Array.from({ length: 22 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>

        <div className="tk-underglow" aria-hidden="true" />

        <div className="tk-apron">
          <div className="tk-brand">
            <span className="tk-stamp">COGITATIO VIRTUALIS</span>
            <span className="tk-stamp-sub">
              MOD. CV-1 / 110V / 60Hz / S/N 0001
            </span>
          </div>
          <div className="tk-toggles">
            <Toggle label="RESUME" />
            <Toggle label="GITHUB" />
            <Toggle label="CONTACT" />
          </div>
        </div>
      </div>
    </section>
  );
}
