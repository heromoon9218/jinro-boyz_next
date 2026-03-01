"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTRPC } from "@/lib/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createVillageSchema, type CreateVillageInput } from "@/lib/validators/village";
import { formatDiscussionTime } from "@/types/village-helpers";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const PLAYER_NUM_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 5);
const DISCUSSION_TIME_OPTIONS = [60, 120, 180, 240, 300, 600];

export function CreateVillageDialog() {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const form = useForm<CreateVillageInput>({
    resolver: zodResolver(createVillageSchema),
    defaultValues: {
      name: "",
      playerNum: 5,
      discussionTime: 180,
      accessPassword: "",
      showVoteTarget: true,
    },
  });

  const createMutation = useMutation(
    trpc.village.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("村を作成しました");
        queryClient.invalidateQueries({ queryKey: [["village"]] });
        setOpen(false);
        form.reset();
        router.push(`/villages/${data.id}`);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  function onSubmit(values: CreateVillageInput) {
    const input = {
      ...values,
      accessPassword: values.accessPassword || undefined,
    };
    createMutation.mutate(input);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>村を作成</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新しい村を作成</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>村名</FormLabel>
                  <FormControl>
                    <Input placeholder="村名を入力" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="playerNum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>定員</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(Number(v))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PLAYER_NUM_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}人
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="discussionTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>議論時間</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(Number(v))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DISCUSSION_TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={String(t)}>
                          {formatDiscussionTime(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accessPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>パスワード（任意）</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="設定しない場合は空欄"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="showVoteTarget"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>投票先を公開</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "作成中..." : "作成する"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
