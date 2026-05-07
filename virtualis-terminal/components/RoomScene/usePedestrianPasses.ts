import { useEffect, useState } from "react";
import { PED_FACING, type PedestrianFacing } from "./pedFacing";
import { useReducedMotion } from "./useReducedMotion";

export type PedestrianDirection = "ltr" | "rtl";

export interface PedestrianPassEvent {
  id: number;
  dir: PedestrianDirection;
  speed: number;
  isCouple: boolean;
  figA: number;
  figB: number;
  scale: number;
  flipA: boolean;
  flipB: boolean;
}

const TOTAL_PEDESTRIANS = 10;

function randomFigure(): number {
  return 1 + Math.floor(Math.random() * TOTAL_PEDESTRIANS);
}

function shouldFlip(figNum: number, dir: PedestrianDirection): boolean {
  const desiredFacing: PedestrianFacing = dir === "ltr" ? "right" : "left";
  return PED_FACING[figNum] !== desiredFacing;
}

function buildPedestrianEvent(): PedestrianPassEvent {
  const dir: PedestrianDirection = Math.random() < 0.5 ? "ltr" : "rtl";
  const figA = randomFigure();
  let figB = randomFigure();

  if (figB === figA) {
    figB = (figB % TOTAL_PEDESTRIANS) + 1;
  }

  return {
    id: Date.now() + Math.random(),
    dir,
    speed: 5.5 + Math.random() * 3.5,
    isCouple: Math.random() < 0.18,
    figA,
    figB,
    scale: 0.85 + Math.random() * 0.3,
    flipA: shouldFlip(figA, dir),
    flipB: shouldFlip(figB, dir),
  };
}

/**
 * Schedules pedestrian silhouettes independently from car passes.
 */
export function usePedestrianPasses(): PedestrianPassEvent | null {
  const [event, setEvent] = useState<PedestrianPassEvent | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      const resetTimer = setTimeout(() => {
        setEvent(null);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    let cancelled = false;
    let fireTimer: ReturnType<typeof setTimeout> | null = null;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (fireTimer) clearTimeout(fireTimer);
      if (clearTimer) clearTimeout(clearTimer);
      fireTimer = null;
      clearTimer = null;
    };

    const schedule = (delay: number) => {
      fireTimer = setTimeout(() => {
        if (cancelled) return;

        const nextEvent = buildPedestrianEvent();
        setEvent(nextEvent);
        clearTimer = setTimeout(
          () => {
            setEvent(null);
          },
          nextEvent.speed * 1000 + 160,
        );
        schedule(nextEvent.speed * 1000 + 60000 + Math.random() * 180000);
      }, delay);
    };

    schedule(10000 + Math.random() * 25000);

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [reducedMotion]);

  return event;
}
