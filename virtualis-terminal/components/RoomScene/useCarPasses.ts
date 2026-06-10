import { useAmbientPasses } from "./useAmbientPasses";

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

function buildCarEvent(): CarPassEvent {
  return {
    id: Date.now() + Math.random(),
    dir: Math.random() < 0.5 ? "ltr" : "rtl",
    speed: 2.4 + Math.random() * 1.6,
    color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
  };
}

function initialCarDelay(): number {
  return 5000 + Math.random() * 20000;
}

function nextCarDelay(event: CarPassEvent): number {
  const isDouble = Math.random() < 0.18;
  if (isDouble) {
    return event.speed * 1000 + 400 + Math.random() * 600;
  }

  return event.speed * 1000 + 30000 + Math.random() * 45000;
}

/**
 * Schedules one car-pass event at a time and clears it after animation.
 */
export function useCarPasses(): CarPassEvent | null {
  return useAmbientPasses({
    buildEvent: buildCarEvent,
    initialDelay: initialCarDelay,
    nextDelay: nextCarDelay,
    clearPaddingMs: 120,
  });
}
