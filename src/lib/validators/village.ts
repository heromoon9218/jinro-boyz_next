import { z } from "zod";

export const createVillageSchema = z.object({
  name: z
    .string()
    .min(1, "村名を入力してください")
    .max(50, "村名は50文字以下で入力してください"),
  playerNum: z
    .number()
    .int()
    .min(5, "最少5人から開始できます")
    .max(16, "最大16人まで参加できます"),
  discussionTime: z
    .number()
    .int()
    .min(60, "議論時間は最短60秒です")
    .max(600, "議論時間は最長600秒です"),
  accessPassword: z.string().optional(),
  showVoteTarget: z.boolean().default(true),
});

export type CreateVillageInput = z.infer<typeof createVillageSchema>;
