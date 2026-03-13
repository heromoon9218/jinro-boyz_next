"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { useRealtimePosts } from "@/lib/hooks/use-realtime-posts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./chat-message";
import type { RoomType, Role, PlayerStatus } from "@/generated/prisma";
import { useGameStore } from "@/stores/game-store";

interface RoomInfo {
  id: string;
  type: RoomType;
}

interface ChatAreaProps {
  rooms: RoomInfo[];
  day: number;
  myRole: Role;
  myStatus: PlayerStatus;
  isEnded: boolean;
}

export function ChatArea({
  rooms,
  day,
  myRole,
  myStatus,
  isEnded,
}: ChatAreaProps) {
  const { activeRoomType, setActiveRoomType } = useGameStore();

  // Filter rooms based on role/status
  const visibleRooms = rooms.filter((room) => {
    if (room.type === "MAIN") return true;
    if (room.type === "WOLF") return myRole === "WEREWOLF";
    if (room.type === "DEAD") return myStatus === "DEAD";
    return false;
  });

  // Ensure active room is valid
  const activeRoom =
    visibleRooms.find((r) => r.type === activeRoomType) ?? visibleRooms[0];

  return (
    <Tabs
      value={activeRoom?.type ?? "MAIN"}
      onValueChange={(val) => setActiveRoomType(val as RoomType)}
      className="flex h-full flex-col"
    >
      <TabsList>
        {visibleRooms.map((room) => (
          <TabsTrigger key={room.id} value={room.type}>
            {roomLabel(room.type)}
          </TabsTrigger>
        ))}
      </TabsList>

      {visibleRooms.map((room) => (
        <TabsContent
          key={room.id}
          value={room.type}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <RoomChat
            roomId={room.id}
            roomType={room.type}
            day={day}
            myRole={myRole}
            myStatus={myStatus}
            isEnded={isEnded}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function roomLabel(type: RoomType): string {
  switch (type) {
    case "MAIN":
      return "メイン";
    case "WOLF":
      return "人狼";
    case "DEAD":
      return "霊界";
  }
}

function RoomChat({
  roomId,
  roomType,
  day,
  myRole,
  myStatus,
  isEnded,
}: {
  roomId: string;
  roomType: RoomType;
  day: number;
  myRole: Role;
  myStatus: PlayerStatus;
  isEnded: boolean;
}) {
  const trpc = useTRPC();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery(
    trpc.game.messages.queryOptions({ roomId, day }),
  );

  useRealtimePosts(roomId);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const sendMutation = useMutation(
    trpc.game.sendMessage.mutationOptions({
      onSuccess: () => setInput(""),
    }),
  );

  // Can post: check room type access rules
  const canPost =
    !isEnded &&
    ((roomType === "MAIN" && myStatus === "ALIVE") ||
      (roomType === "WOLF" &&
        myRole === "WEREWOLF" &&
        myStatus === "ALIVE") ||
      (roomType === "DEAD" && myStatus === "DEAD"));

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate({ roomId, content: trimmed });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-2"
      >
        {messages?.map((msg) => (
          <ChatMessage
            key={msg.id}
            content={msg.content}
            owner={msg.owner}
            player={msg.player}
            createdAt={msg.createdAt}
          />
        ))}
        {(!messages || messages.length === 0) && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            メッセージはありません
          </p>
        )}
      </div>

      {canPost && (
        <form
          onSubmit={handleSend}
          className="flex gap-2 border-t px-3 py-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            maxLength={1000}
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || sendMutation.isPending}
          >
            送信
          </Button>
        </form>
      )}
    </div>
  );
}
