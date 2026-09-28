"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * The server does not know the learner's timezone, so the time is formatted
 * in the browser. The server render says "later" until then.
 */
export function NextRoundTime({ at }: { at: number }) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatNextRound(at, Date.now()),
    () => null
  );
  return <>{label ?? "later"}</>;
}

export function formatNextRound(at: number, now: number): string {
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    at
  );
  const sameDay = new Date(at).toDateString() === new Date(now).toDateString();
  return sameDay ? `at ${time}` : `tomorrow at ${time}`;
}
