import { useEffect, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

export interface AmbientPassEvent {
  id: number;
  speed: number;
}

export interface AmbientPassSchedule<T extends AmbientPassEvent> {
  buildEvent: () => T;
  initialDelay: () => number;
  nextDelay: (event: T) => number;
  /** Extra time the event stays mounted after its animation finishes. */
  clearPaddingMs: number;
}

/**
 * Shared scheduler for one-at-a-time ambient scene events: waits, fires the
 * next event, clears it once its animation has played out, and repeats.
 *
 * The schedule callbacks must be stable references (module-level functions);
 * they are effect dependencies, so a new identity restarts the scheduler.
 */
export function useAmbientPasses<T extends AmbientPassEvent>({
  buildEvent,
  initialDelay,
  nextDelay,
  clearPaddingMs,
}: AmbientPassSchedule<T>): T | null {
  const [event, setEvent] = useState<T | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    let cancelled = false;
    let fireTimer: ReturnType<typeof setTimeout> | null = null;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delay: number) => {
      fireTimer = setTimeout(() => {
        if (cancelled) return;

        const nextEvent = buildEvent();
        setEvent(nextEvent);
        clearTimer = setTimeout(
          () => {
            setEvent(null);
          },
          nextEvent.speed * 1000 + clearPaddingMs,
        );
        schedule(nextDelay(nextEvent));
      }, delay);
    };

    schedule(initialDelay());

    return () => {
      cancelled = true;
      if (fireTimer) clearTimeout(fireTimer);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [reducedMotion, buildEvent, initialDelay, nextDelay, clearPaddingMs]);

  // Derived at render time instead of cleared via setState in the effect,
  // which would trigger a cascading render.
  return reducedMotion ? null : event;
}
