"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";

interface CountdownTimerProps {
  nextUpdateTime: Date | null;
  villageId: string;
}

export function CountdownTimer({
  nextUpdateTime,
  villageId,
}: CountdownTimerProps) {
  const trpc = useTRPC();

  const { mutate, isPending } = useMutation(
    trpc.game.triggerProceed.mutationOptions(),
  );
  const pendingRef = useRef(isPending);
  const triggeredDeadlineRef = useRef<string | null>(null);
  const deadlineKey = nextUpdateTime ? new Date(nextUpdateTime).toISOString() : null;

  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    triggeredDeadlineRef.current = null;
  }, [deadlineKey]);

  const triggerProceed = useCallback(() => {
    if (!deadlineKey) return;
    if (pendingRef.current) return;
    if (triggeredDeadlineRef.current === deadlineKey) return;

    triggeredDeadlineRef.current = deadlineKey;
    mutate({ villageId });
  }, [deadlineKey, mutate, villageId]);

  const computeRemaining = useCallback((currentTime: number): string => {
    if (!nextUpdateTime) return "--:--";
    const diff = new Date(nextUpdateTime).getTime() - currentTime;
    if (diff <= 0) return "00:00";
    const totalSeconds = Math.ceil(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [nextUpdateTime]);

  const [now, setNow] = useState(() => Date.now());
  const remaining = computeRemaining(now);

  useEffect(() => {
    if (!nextUpdateTime) return;

    const interval = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      const value = computeRemaining(currentTime);
      if (value === "00:00") {
        triggerProceed();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [computeRemaining, nextUpdateTime, triggerProceed]);

  return (
    <span className="font-mono text-lg tabular-nums">{remaining}</span>
  );
}
