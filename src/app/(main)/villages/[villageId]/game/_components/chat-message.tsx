"use client";

import type { PostOwner } from "@/generated/prisma";

interface ChatMessageProps {
  content: string;
  owner: PostOwner;
  player: { id: string; username: string } | null;
  createdAt: Date;
}

export function ChatMessage({
  content,
  owner,
  player,
  createdAt,
}: ChatMessageProps) {
  if (owner === "SYSTEM") {
    return (
      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap text-muted-foreground">
        {content}
      </div>
    );
  }

  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-semibold">{player?.username ?? "???"}</span>
      <span className="flex-1 break-all">{content}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatTime(createdAt)}
      </span>
    </div>
  );
}

function formatTime(date: Date): string {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
