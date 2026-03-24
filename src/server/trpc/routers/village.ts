import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma";
import type { Role } from "@/generated/prisma";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/server/trpc/init";
import {
  createVillageSchema,
  villageListSchema,
  joinVillageSchema,
  leaveVillageSchema,
  startVillageSchema,
  ruinVillageSchema,
  kickPlayerSchema,
} from "@/lib/validators/village";
import { assignRoles } from "@/server/game/assign-roles";
import { startMessage } from "@/server/game/system-messages";

export const villageRouter = createTRPCRouter({
  list: publicProcedure
    .input(villageListSchema)
    .query(async ({ ctx, input }) => {
      const { filter, page, perPage } = input;

      const statusFilter =
        filter === "active"
          ? { in: ["NOT_STARTED" as const, "IN_PLAY" as const] }
          : { in: ["ENDED" as const, "RUINED" as const] };

      const [villages, total] = await Promise.all([
        ctx.db.village.findMany({
          where: { status: statusFilter },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          select: {
            id: true,
            name: true,
            playerNum: true,
            discussionTime: true,
            status: true,
            scheduledStartAt: true,
            accessPassword: true,
            createdAt: true,
            user: { select: { username: true } },
            _count: { select: { players: true } },
          },
        }),
        ctx.db.village.count({ where: { status: statusFilter } }),
      ]);

      return {
        villages: villages.map(({ accessPassword, ...rest }) => ({
          ...rest,
          hasPassword: !!accessPassword,
        })),
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage),
        },
      };
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const village = await ctx.db.village.findUnique({
        where: { id: input.id },
        include: {
          user: { select: { id: true, username: true, authId: true } },
          players: {
            include: { user: { select: { id: true, username: true, authId: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!village) {
        throw new TRPCError({ code: "NOT_FOUND", message: "村が見つかりません" });
      }

      // 認証ユーザーのauthIdを取得（ログインしている場合）
      const authUser = ctx.user;
      const currentAuthId = authUser?.id ?? null;

      // authId を除外し、isOwner/isParticipant をサーバー側で解決
      const { user, players, accessPassword, ...villageData } = village;

      // ゲーム進行中（IN_PLAY）は role を隠蔽。終了後（ENDED）のみ結果表示のため公開
      const hideRole = village.status === "IN_PLAY" || village.status === "NOT_STARTED";

      return {
        ...villageData,
        hasPassword: !!accessPassword,
        user: { id: user.id, username: user.username },
        players: players.map(({ user: playerUser, role, ...player }) => ({
          ...player,
          ...(hideRole ? {} : { role }),
          user: { id: playerUser.id, username: playerUser.username },
        })),
        isLoggedIn: !!currentAuthId,
        isOwner: currentAuthId === user.authId,
        isParticipant: players.some((p) => p.user.authId === currentAuthId),
      };
    }),

  create: protectedProcedure
    .input(createVillageSchema)
    .mutation(async ({ ctx, input }) => {
      const { dbUser } = ctx;
      const { discussionTime, ...rest } = input;

      return ctx.db.$transaction(async (tx) => {
        const village = await tx.village.create({
          data: {
            ...rest,
            discussionTime: discussionTime * 60, // 分→秒に変換
            userId: dbUser.id,
          },
        });

        // 作成者を自動的にプレイヤーとして追加
        await tx.player.create({
          data: {
            username: dbUser.username,
            userId: dbUser.id,
            villageId: village.id,
          },
        });

        // accessPassword を除外し、hasPassword に変換（list/byId と同様）
        const { accessPassword, ...villageData } = village;
        return { ...villageData, hasPassword: !!accessPassword };
      });
    }),

  join: protectedProcedure
    .input(joinVillageSchema)
    .mutation(async ({ ctx, input }) => {
      const { dbUser } = ctx;

      return ctx.db.$transaction(async (tx) => {
        // 同時参加の競合を防ぐため、Village 行を FOR UPDATE でロック
        const locked = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM villages WHERE id = ${input.villageId} FOR UPDATE`
        );
        if (locked.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "村が見つかりません",
          });
        }

        const [village, existingPlayer, blacklisted] = await Promise.all([
          tx.village.findUnique({
            where: { id: input.villageId },
            select: {
              status: true,
              playerNum: true,
              accessPassword: true,
              _count: { select: { players: true } },
            },
          }),
          tx.player.findUnique({
            where: {
              userId_villageId: {
                userId: dbUser.id,
                villageId: input.villageId,
              },
            },
          }),
          tx.blacklistUser.findUnique({
            where: {
              userId_villageId: {
                userId: dbUser.id,
                villageId: input.villageId,
              },
            },
          }),
        ]);

        if (!village) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "村が見つかりません",
          });
        }

        if (village.status !== "NOT_STARTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "この村はすでに開始されています",
          });
        }

        if (village._count.players >= village.playerNum) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "定員に達しています",
          });
        }

        if (existingPlayer) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "すでに参加しています",
          });
        }

        if (blacklisted) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "この村には参加できません",
          });
        }

        // 合言葉チェック
        if (village.accessPassword) {
          if (!input.accessPassword || input.accessPassword !== village.accessPassword) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "合言葉が一致しません",
            });
          }
        }

        return tx.player.create({
          data: {
            username: dbUser.username,
            userId: dbUser.id,
            villageId: input.villageId,
          },
        });
      });
    }),

  leave: protectedProcedure
    .input(leaveVillageSchema)
    .mutation(async ({ ctx, input }) => {
      const { dbUser } = ctx;

      return ctx.db.$transaction(async (tx) => {
        // start/join と競合しないよう、村行を FOR UPDATE でロック
        const locked = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM villages WHERE id = ${input.villageId} FOR UPDATE`
        );
        if (locked.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "村が見つかりません",
          });
        }

        const [village, player] = await Promise.all([
          tx.village.findUnique({
            where: { id: input.villageId },
            select: { status: true, userId: true },
          }),
          tx.player.findUnique({
            where: {
              userId_villageId: {
                userId: dbUser.id,
                villageId: input.villageId,
              },
            },
          }),
        ]);

        if (!village) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "村が見つかりません",
          });
        }

        if (village.status !== "NOT_STARTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "開始済みの村からは退出できません",
          });
        }

        if (village.userId === dbUser.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "村主は退出できません",
          });
        }

        if (!player) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "参加していません",
          });
        }

        return tx.player.delete({
          where: { id: player.id },
        });
      });
    }),

  start: protectedProcedure
    .input(startVillageSchema)
    .mutation(async ({ ctx, input }) => {
      const { dbUser } = ctx;

      return ctx.db.$transaction(async (tx) => {
        // 同時に leave/join が走らないよう、村行を FOR UPDATE でロック
        const locked = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM villages WHERE id = ${input.villageId} FOR UPDATE`
        );
        if (locked.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "村が見つかりません",
          });
        }

        const village = await tx.village.findUnique({
          where: { id: input.villageId },
          include: { players: { select: { id: true } } },
        });

        if (!village) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "村が見つかりません",
          });
        }

        if (village.userId !== dbUser.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "村主のみがゲームを開始できます",
          });
        }

        if (village.status !== "NOT_STARTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "この村はすでに開始されています",
          });
        }

        if (village.players.length !== village.playerNum) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `定員（${village.playerNum}人）に達していません（現在${village.players.length}人）`,
          });
        }

        // ロール割り当て — ロール別にupdateManyでバッチ更新
        const playerIds = village.players.map((p) => p.id);
        const roleAssignments = assignRoles(playerIds);

        const byRole = new Map<Role, string[]>();
        for (const [playerId, role] of roleAssignments) {
          if (!byRole.has(role)) byRole.set(role, []);
          byRole.get(role)!.push(playerId);
        }
        await Promise.all(
          [...byRole.entries()].map(([role, ids]) =>
            tx.player.updateMany({
              where: { id: { in: ids } },
              data: { role },
            }),
          ),
        );

        // Room作成（MAIN, WOLF, DEAD）
        await tx.room.createMany({
          data: [
            { type: "MAIN", villageId: village.id },
            { type: "WOLF", villageId: village.id },
            { type: "DEAD", villageId: village.id },
          ],
        });

        const now = new Date();

        // 村ステータス更新
        await tx.village.update({
          where: { id: village.id },
          data: {
            status: "IN_PLAY",
            day: 1,
            startAt: now,
            nextUpdateTime: new Date(
              now.getTime() + village.discussionTime * 1000
            ),
          },
        });

        // Day 1のRecordを全プレイヤー分作成
        await tx.record.createMany({
          data: playerIds.map((playerId) => ({
            day: 1,
            playerId,
            villageId: village.id,
          })),
        });

        // 開始システムメッセージをMAINルームに投稿
        const mainRoom = await tx.room.findUnique({
          where: {
            villageId_type: { villageId: village.id, type: "MAIN" },
          },
        });
        if (mainRoom) {
          const wolfCount = [...roleAssignments.values()].filter(
            (r) => r === "WEREWOLF",
          ).length;
          await tx.post.create({
            data: {
              content: startMessage(wolfCount),
              day: 1,
              owner: "SYSTEM",
              roomId: mainRoom.id,
            },
          });
        }

        return { success: true };
      });
    }),

  ruin: protectedProcedure
    .input(ruinVillageSchema)
    .mutation(async ({ ctx, input }) => {
      const { dbUser } = ctx;

      return ctx.db.$transaction(async (tx) => {
        const village = await tx.village.findUnique({
          where: { id: input.villageId },
          select: { id: true, status: true, userId: true },
        });

        if (!village) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "村が見つかりません",
          });
        }

        if (village.userId !== dbUser.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "村主のみが廃村できます",
          });
        }

        if (village.status === "ENDED" || village.status === "RUINED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "この村はすでに終了しています",
          });
        }

        return tx.village.update({
          where: { id: village.id },
          data: { status: "RUINED" },
        });
      });
    }),

  kick: protectedProcedure
    .input(kickPlayerSchema)
    .mutation(async ({ ctx, input }) => {
      const { dbUser } = ctx;

      return ctx.db.$transaction(async (tx) => {
        const [village, player] = await Promise.all([
          tx.village.findUnique({
            where: { id: input.villageId },
            select: { status: true, userId: true },
          }),
          tx.player.findFirst({
            where: {
              id: input.playerId,
              villageId: input.villageId,
            },
            select: { id: true, userId: true },
          }),
        ]);

        if (!village) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "村が見つかりません",
          });
        }

        if (village.userId !== dbUser.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "村主のみがキックできます",
          });
        }

        if (village.status !== "NOT_STARTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "開始前の村でのみキックできます",
          });
        }

        if (!player) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "プレイヤーが見つかりません",
          });
        }

        if (player.userId === dbUser.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "自分自身はキックできません",
          });
        }

        // ブラックリストに追加
        await tx.blacklistUser.create({
          data: {
            userId: player.userId,
            villageId: input.villageId,
            reason: "村主によるキック",
          },
        });

        // プレイヤー削除
        return tx.player.delete({
          where: { id: player.id },
        });
      });
    }),
});
