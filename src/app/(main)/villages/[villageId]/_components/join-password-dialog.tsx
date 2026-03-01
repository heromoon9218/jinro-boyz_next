"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface JoinPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => void;
  isPending: boolean;
}

export function JoinPasswordDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: JoinPasswordDialogProps) {
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(password);
    setPassword("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>パスワードを入力</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join-password">パスワード</Label>
            <Input
              id="join-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "参加中..." : "参加する"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
