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
    .transform((s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""))
    .pipe(
      z
        .string()
        .min(1, "メッセージを入力してください")
        .max(1000, "メッセージは1000文字以下で入力してください"),
    ),
});

export const messagesSchema = z.object({
  roomId: z.string(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z
    .object({
      createdAt: z.string().datetime(),
      id: z.string(),
    })
    .nullish(),
});
