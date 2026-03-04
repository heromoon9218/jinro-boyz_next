import { z } from "zod";

export const gameStateSchema = z.object({
  villageId: z.string(),
});

export const gameActionSchema = z.object({
  villageId: z.string(),
  targetPlayerId: z.string(),
});

export const sendMessageSchema = z.object({
  roomId: z.string(),
  content: z
    .string()
    .min(1, "メッセージを入力してください")
    .max(1000, "メッセージは1000文字以下で入力してください"),
});

export const messagesSchema = z.object({
  roomId: z.string(),
  day: z.number().int().min(1),
});
