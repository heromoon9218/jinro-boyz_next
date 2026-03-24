"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ChatInputProps {
  roomId: string;
}

export function ChatInput({ roomId }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const sendMutation = useMutation(
    trpc.game.sendMessage.mutationOptions({
      onSuccess: () => {
        setMessage("");
        queryClient.invalidateQueries({
          queryKey: trpc.game.posts.queryKey({ roomId }),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;
    sendMutation.mutate({ roomId, content: trimmed });
  }, [message, roomId, sendMutation]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex gap-2 border-t p-2">
      <textarea
        className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        rows={2}
        maxLength={500}
        placeholder="メッセージを入力... (Ctrl+Enter で送信)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Button
        size="sm"
        className="self-end"
        onClick={handleSend}
        disabled={!message.trim() || sendMutation.isPending}
      >
        送信
      </Button>
    </div>
  );
}
