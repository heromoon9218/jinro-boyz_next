"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({ initialComment }: { initialComment: string }) {
  const [comment, setComment] = useState(initialComment);
  const trpc = useTRPC();

  const updateProfile = useMutation(
    trpc.user.updateProfile.mutationOptions({
      onSuccess: () => {
        toast.success("プロフィールを更新しました");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="comment">ひとこと</Label>
        <Input
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="自己紹介やひとことを入力..."
          maxLength={500}
        />
      </div>
      <Button
        onClick={() => updateProfile.mutate({ comment: comment || null })}
        disabled={updateProfile.isPending}
      >
        {updateProfile.isPending ? "保存中..." : "保存"}
      </Button>
    </div>
  );
}
