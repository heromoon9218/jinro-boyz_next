"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { useRealtimePosts } from "@/lib/hooks/use-realtime-posts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./chat-message";
import type { RoomType, Role, PlayerStatus } from "@/generated/prisma";
import { useGameStore } from "@/stores/game-store";

const PAGE_SIZE = 20;

interface RoomInfo {
  id: string;
  type: RoomType;
}

interface ChatAreaProps {
  rooms: RoomInfo[];
  myRole: Role;
  myStatus: PlayerStatus;
  isEnded: boolean;
}

export function ChatArea({
  rooms,
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

export function RoomChat({
  roomId,
  roomType,
  myRole,
  myStatus,
  isEnded,
}: {
  roomId: string;
  roomType: RoomType;
  myRole: Role;
  myStatus: PlayerStatus;
  isEnded: boolean;
}) {
  const trpc = useTRPC();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolledRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const prependInFlightRef = useRef(false);
  const previousScrollHeightRef = useRef(0);
  const previousScrollTopRef = useRef(0);

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    trpc.game.messages.infiniteQueryOptions(
      { roomId, limit: PAGE_SIZE },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    ),
  );
  const messages = useMemo(
    () => data?.pages.toReversed().flatMap((page) => page.items) ?? [],
    [data],
  );
  const firstMessageId = messages[0]?.id;
  const lastMessageId = messages.at(-1)?.id;

  useRealtimePosts(roomId);

  useEffect(() => {
    hasAutoScrolledRef.current = false;
    isNearBottomRef.current = true;
    prependInFlightRef.current = false;
    previousScrollHeightRef.current = 0;
    previousScrollTopRef.current = 0;
  }, [roomId]);

  // Keep scroll position when older messages are prepended,
  // and auto-follow new messages only when the user is near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (prependInFlightRef.current) {
      el.scrollTop =
        el.scrollHeight -
        previousScrollHeightRef.current +
        previousScrollTopRef.current;
      prependInFlightRef.current = false;
      return;
    }

    if (!hasAutoScrolledRef.current || isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      hasAutoScrolledRef.current = true;
    }
  }, [roomId, messages.length, firstMessageId, lastMessageId]);

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

  const loadOlderMessages = useCallback(
    (el: HTMLDivElement) => {
      if (!hasNextPage || isFetchingNextPage || prependInFlightRef.current) {
        return;
      }

      previousScrollHeightRef.current = el.scrollHeight;
      previousScrollTopRef.current = el.scrollTop;
      prependInFlightRef.current = true;
      void fetchNextPage().catch(() => {
        prependInFlightRef.current = false;
      });
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceToBottom < 120;

    if (el.scrollTop > 80) {
      return;
    }

    loadOlderMessages(el);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight > el.clientHeight + 1) return;
    loadOlderMessages(el);
  }, [roomId, messages.length, loadOlderMessages]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-testid="chat-scroll-container"
        className="flex-1 space-y-2 overflow-y-auto px-3 py-2"
      >
        {isFetchingNextPage && (
          <p className="py-2 text-center text-xs text-muted-foreground">
            過去のメッセージを読み込み中...
          </p>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            content={msg.content}
            owner={msg.owner}
            player={msg.player}
            createdAt={msg.createdAt}
          />
        ))}
        {!isLoading && messages.length === 0 && (
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
