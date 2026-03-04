"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { VillageStatus } from "@/generated/prisma";
import { toast } from "sonner";
import { JoinPasswordDialog } from "./join-password-dialog";

interface VillageActionsProps {
  village: {
    id: string;
    status: VillageStatus;
    playerNum: number;
    hasPassword: boolean;
    players: { id: string; userId: string }[];
    user: { id: string };
  };
  isLoggedIn: boolean;
  isOwner: boolean;
  isParticipant: boolean;
}

export function VillageActions({
  village,
  isLoggedIn,
  isOwner,
  isParticipant,
}: VillageActionsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["village"]] });
  };

  const joinMutation = useMutation(
    trpc.village.join.mutationOptions({
      onSuccess: () => {
        toast.success("村に参加しました");
        setShowJoinDialog(false);
        invalidate();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const leaveMutation = useMutation(
    trpc.village.leave.mutationOptions({
      onSuccess: () => {
        toast.success("村から退出しました");
        invalidate();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const startMutation = useMutation(
    trpc.village.start.mutationOptions({
      onSuccess: () => {
        toast.success("ゲームを開始しました");
        invalidate();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const ruinMutation = useMutation(
    trpc.village.ruin.mutationOptions({
      onSuccess: () => {
        toast.success("村を廃村にしました");
        invalidate();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  if (!isLoggedIn) return null;

  const isFull = village.players.length >= village.playerNum;

  function handleJoin() {
    if (village.hasPassword) {
      setShowJoinDialog(true);
    } else {
      joinMutation.mutate({ villageId: village.id });
    }
  }

  function handleJoinWithPassword(password: string) {
    joinMutation.mutate({
      villageId: village.id,
      accessPassword: password,
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* ゲーム画面へボタン: IN_PLAY + 参加者 */}
      {village.status === "IN_PLAY" && isParticipant && (
        <Button
          onClick={() => router.push(`/villages/${village.id}/game`)}
        >
          ゲーム画面へ
        </Button>
      )}

      {/* 参加ボタン: 未開始 + 未参加 + 定員未到達 */}
      {village.status === "NOT_STARTED" && !isParticipant && !isFull && (
        <Button
          onClick={handleJoin}
          disabled={joinMutation.isPending}
        >
          {joinMutation.isPending ? "参加中..." : "参加する"}
        </Button>
      )}

      {/* 参加パスワードダイアログ: 条件ブロック外に配置し、isFull によるアンマウントを防ぐ */}
      {village.status === "NOT_STARTED" && !isParticipant && (
        <JoinPasswordDialog
          key={String(showJoinDialog)}
          open={showJoinDialog}
          onOpenChange={setShowJoinDialog}
          onSubmit={handleJoinWithPassword}
          isPending={joinMutation.isPending}
        />
      )}

      {/* 退出ボタン: 未開始 + 参加中 + 村主でない */}
      {village.status === "NOT_STARTED" && isParticipant && !isOwner && (
        <Button
          variant="outline"
          onClick={() => leaveMutation.mutate({ villageId: village.id })}
          disabled={leaveMutation.isPending}
        >
          {leaveMutation.isPending ? "退出中..." : "退出する"}
        </Button>
      )}

      {/* 開始ボタン: 村主 + 未開始 + 定員到達 */}
      {isOwner && village.status === "NOT_STARTED" && isFull && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>ゲーム開始</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ゲームを開始しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                開始すると役職が割り当てられ、ゲームが始まります。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  startMutation.mutate({ villageId: village.id })
                }
              >
                開始する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* 廃村ボタン: 村主 + 未終了 */}
      {isOwner &&
        village.status !== "ENDED" &&
        village.status !== "RUINED" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">廃村</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>廃村にしますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  この操作は取り消せません。村は終了となります。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() =>
                    ruinMutation.mutate({ villageId: village.id })
                  }
                >
                  廃村にする
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
    </div>
  );
}
