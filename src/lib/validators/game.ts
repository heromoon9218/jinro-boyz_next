import { z } from "zod";

const villageIdSchema = z.object({
  villageId: z.string().cuid(),
});

export const gameStateSchema = villageIdSchema;
export type GameStateInput = z.infer<typeof gameStateSchema>;

export const actionSchema = z.object({
  villageId: z.string().cuid(),
  targetPlayerId: z.string().cuid(),
});
export type ActionInput = z.infer<typeof actionSchema>;

export const sendMessageSchema = z.object({
  roomId: z.string().cuid(),
  content: z
    .string()
    .min(1, "メッセージを入力してください")
    .max(500, "メッセージは500文字以内です"),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const postsSchema = z.object({
  roomId: z.string().cuid(),
  day: z.number().int().optional(),
});
export type PostsInput = z.infer<typeof postsSchema>;
