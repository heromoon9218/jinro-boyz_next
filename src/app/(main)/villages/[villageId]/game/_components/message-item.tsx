import type { PostOwner } from "@/generated/prisma";

interface MessageItemProps {
  content: string;
  owner: PostOwner;
  playerName: string | null;
  createdAt: Date;
}

export function MessageItem({
  content,
  owner,
  playerName,
  createdAt,
}: MessageItemProps) {
  const time = new Date(createdAt);
  const timeStr = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;

  if (owner === "SYSTEM") {
    return (
      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <div className="whitespace-pre-wrap">{content}</div>
        <div className="mt-1 text-xs opacity-60">{timeStr}</div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 text-sm">
      <div className="flex items-baseline gap-2">
        <span className="font-medium">{playerName ?? "???"}</span>
        <span className="text-xs text-muted-foreground">{timeStr}</span>
      </div>
      <div className="mt-0.5 whitespace-pre-wrap">{content}</div>
    </div>
  );
}
