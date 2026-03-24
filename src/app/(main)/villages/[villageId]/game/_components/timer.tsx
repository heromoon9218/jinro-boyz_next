"use client";

import { useMemo, useSyncExternalStore } from "react";

interface TimerProps {
  nextUpdateTime: Date | string | null;
}

function formatRemaining(targetMs: number): string {
  const diff = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function useTimer(targetMs: number | null): string {
  const subscribe = useMemo(() => {
    if (targetMs === null) return (cb: () => void) => { cb(); return () => {}; };
    return (cb: () => void) => {
      const id = setInterval(cb, 1000);
      return () => clearInterval(id);
    };
  }, [targetMs]);

  return useSyncExternalStore(
    subscribe,
    () => (targetMs === null ? "" : formatRemaining(targetMs)),
    () => (targetMs === null ? "" : formatRemaining(targetMs)),
  );
}

export function Timer({ nextUpdateTime }: TimerProps) {
  const targetMs = nextUpdateTime
    ? new Date(nextUpdateTime).getTime()
    : null;
  const remaining = useTimer(targetMs);

  if (!remaining) return null;

  return (
    <span className="tabular-nums font-mono text-sm font-medium">
      {remaining}
    </span>
  );
}
