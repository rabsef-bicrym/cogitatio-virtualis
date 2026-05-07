import { useEffect, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

export type CarDirection = "ltr" | "rtl";

export interface CarPassEvent {
  id: number;
  dir: CarDirection;
  speed: number;
  color: string;
}

const CAR_COLORS = [
  "255, 245, 220",
  "255, 245, 220",
  "255, 245, 220",
  "210, 230, 255",
  "255, 200, 120",
];

function nextCarDelay(speed: number): number {
  const isDouble = Math.random() < 0.18;
  if (isDouble) {
    return speed * 1000 + 400 + Math.random() * 600;
  }

  return speed * 1000 + 30000 + Math.random() * 45000;
}

function buildCarEvent(): CarPassEvent {
  return {
    id: Date.now() + Math.random(),
    dir: Math.random() < 0.5 ? "ltr" : "rtl",
    speed: 2.4 + Math.random() * 1.6,
    color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
  };
}

/**
 * Schedules one car-pass event at a time and clears it after animation.
 */
export function useCarPasses(): CarPassEvent | null {
  const [event, setEvent] = useState<CarPassEvent | null>(null);
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

        const nextEvent = buildCarEvent();
        setEvent(nextEvent);
        clearTimer = setTimeout(
          () => {
            setEvent(null);
          },
          nextEvent.speed * 1000 + 120,
        );
        schedule(nextCarDelay(nextEvent.speed));
      }, delay);
    };

    schedule(5000 + Math.random() * 20000);

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [reducedMotion]);

  return event;
}
