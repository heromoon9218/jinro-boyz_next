"use client";

import { useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { useRealtimePosts } from "@/lib/hooks/use-realtime-posts";
import { MessageItem } from "./message-item";
import { ChatInput } from "./chat-input";

interface ChatAreaProps {
  roomId: string;
  canSpeak: boolean;
}

export function ChatArea({ roomId, canSpeak }: ChatAreaProps) {
  const trpc = useTRPC();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useRealtimePosts(roomId);

  const { data: posts } = useQuery(
    trpc.game.posts.queryOptions({ roomId }),
  );

  // Track if user is scrolled to bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  // Auto-scroll via sentinel ref callback
  const bottomCallback = useCallback(
    (node: HTMLDivElement | null) => {
      (bottomRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (node && isAtBottomRef.current) {
        node.scrollIntoView({ block: "end" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-1 overflow-y-auto p-2"
      >
        {posts?.map((post) => (
          <MessageItem
            key={post.id}
            content={post.content}
            owner={post.owner}
            playerName={post.player?.username ?? null}
            createdAt={post.createdAt}
          />
        ))}
        {(!posts || posts.length === 0) && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            メッセージはまだありません
          </p>
        )}
        <div ref={bottomCallback} />
      </div>
      {canSpeak && <ChatInput roomId={roomId} />}
    </div>
  );
}
