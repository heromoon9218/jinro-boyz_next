"use client";

import { useEffect, useState, useCallback } from "react";
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

  const triggerMutation = useMutation(
    trpc.game.triggerProceed.mutationOptions(),
  );

  const triggerProceed = useCallback(() => {
    if (!triggerMutation.isPending) {
      triggerMutation.mutate({ villageId });
    }
  }, [triggerMutation, villageId]);

  const computeRemaining = useCallback((): string => {
    if (!nextUpdateTime) return "--:--";
    const diff = new Date(nextUpdateTime).getTime() - Date.now();
    if (diff <= 0) return "00:00";
    const totalSeconds = Math.ceil(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [nextUpdateTime]);

  const [remaining, setRemaining] = useState(() => computeRemaining());

  useEffect(() => {
    const interval = setInterval(() => {
      const value = computeRemaining();
      setRemaining(value);
      if (value === "00:00") {
        triggerProceed();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [computeRemaining, triggerProceed]);

  return (
    <span className="font-mono text-lg tabular-nums">{remaining}</span>
  );
}
