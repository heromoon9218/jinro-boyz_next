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
    .min(1, "議論時間は最短1分です")
    .max(1440, "議論時間は最長1440分です"),
  accessPassword: z.string().optional(),
  scheduledStartAt: z.date({ error: "開始予定を入力してください" }).optional(),
  showVoteTarget: z.boolean(),
});

export type CreateVillageInput = z.infer<typeof createVillageSchema>;

export const villageListSchema = z.object({
  filter: z.enum(["active", "ended"]).default("active"),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(50).default(10),
});

export type VillageListInput = z.infer<typeof villageListSchema>;

export const joinVillageSchema = z.object({
  villageId: z.string(),
  accessPassword: z.string().optional(),
});

export type JoinVillageInput = z.infer<typeof joinVillageSchema>;

const villageIdSchema = z.object({
  villageId: z.string(),
});

export const leaveVillageSchema = villageIdSchema;
export type LeaveVillageInput = z.infer<typeof leaveVillageSchema>;

export const startVillageSchema = villageIdSchema;
export type StartVillageInput = z.infer<typeof startVillageSchema>;

export const ruinVillageSchema = villageIdSchema;
export type RuinVillageInput = z.infer<typeof ruinVillageSchema>;

export const kickPlayerSchema = z.object({
  villageId: z.string(),
  playerId: z.string(),
});

export type KickPlayerInput = z.infer<typeof kickPlayerSchema>;
