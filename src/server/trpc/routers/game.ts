import { TRPCError } from "@trpc/server";
import { Role } from "@/generated/prisma";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/server/trpc/init";
import { proceedDay } from "@/server/game/proceed-day";
import {
  gameStateSchema,
  actionSchema,
  sendMessageSchema,
  postsSchema,
} from "@/lib/validators/game";
import { wolfAttackSetMessage } from "@/server/game/system-messages";

export const gameRouter = createTRPCRouter({
  state: publicProcedure
    .input(gameStateSchema)
    .query(async ({ ctx, input }) => {
      const village = await ctx.db.village.findUnique({
        where: { id: input.villageId },
        include: {
          players: {
            include: { user: { select: { id: true, authId: true } } },
            orderBy: { createdAt: "asc" },
          },
          rooms: { select: { id: true, type: true } },
        },
      });

      if (!village) {
        throw new TRPCError({ code: "NOT_FOUND", message: "村が見つかりません" });
      }

      const authId = ctx.user?.id ?? null;
      const currentPlayer = authId
        ? village.players.find((p) => p.user.authId === authId)
        : undefined;

      // Resolve accessible rooms based on role/status
      const isGameEnded =
        village.status === "ENDED" || village.status === "RUINED";
      const accessibleRooms = village.rooms.filter((room) => {
        if (isGameEnded) return true;
        if (room.type === "MAIN") return true;
        if (room.type === "WOLF")
          return currentPlayer?.role === Role.WEREWOLF;
        if (room.type === "DEAD")
          return currentPlayer?.status === "DEAD";
        return false;
      });

      // Get current record
      let currentRecord = null;
      if (
        currentPlayer &&
        village.status === "IN_PLAY" &&
        currentPlayer.status === "ALIVE"
      ) {
        currentRecord = await ctx.db.record.findUnique({
          where: {
            playerId_villageId_day: {
              playerId: currentPlayer.id,
              villageId: village.id,
              day: village.day,
            },
          },
          select: {
            id: true,
            voteTargetId: true,
            attackTargetId: true,
            divineTargetId: true,
            guardTargetId: true,
          },
        });
      }

      // Build player list (hide roles during game, but reveal fellow werewolves)
      const isSelfWerewolf = currentPlayer?.role === Role.WEREWOLF;
      const players = village.players.map((p) => ({
        id: p.id,
        username: p.username,
        status: p.status,
        ...(isGameEnded ||
        p.user.authId === authId ||
        (isSelfWerewolf && p.role === Role.WEREWOLF)
          ? { role: p.role }
          : {}),
      }));

      return {
        village: {
          id: village.id,
          name: village.name,
          day: village.day,
          status: village.status,
          winner: village.winner,
          discussionTime: village.discussionTime,
          showVoteTarget: village.showVoteTarget,
          nextUpdateTime: village.nextUpdateTime,
        },
        currentPlayer: currentPlayer
          ? {
              id: currentPlayer.id,
              role: currentPlayer.role,
              status: currentPlayer.status,
            }
          : null,
        players,
        rooms: accessibleRooms,
        currentRecord,
      };
    }),

  vote: protectedProcedure
    .input(actionSchema)
    .mutation(async ({ ctx, input }) => {
      const { record, village } = await resolveRecord(
        ctx,
        input.villageId,
        null,
      );

      // Can't vote for yourself
      if (record.playerId === input.targetPlayerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "自分自身には投票できません",
        });
      }

      // Target must be alive
      await assertTargetAlive(ctx, input.targetPlayerId, village.id);

      return ctx.db.record.update({
        where: { id: record.id },
        data: { voteTargetId: input.targetPlayerId },
      });
    }),

  attack: protectedProcedure
    .input(actionSchema)
    .mutation(async ({ ctx, input }) => {
      const { record, player, village } = await resolveRecord(
        ctx,
        input.villageId,
        Role.WEREWOLF,
      );

      // Target must be alive and not a werewolf
      const target = await assertTargetAlive(
        ctx,
        input.targetPlayerId,
        village.id,
      );
      if (target.role === Role.WEREWOLF) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "人狼は襲撃できません",
        });
      }

      // Post system message to wolf room
      const wolfRoom = await ctx.db.room.findUnique({
        where: { villageId_type: { villageId: village.id, type: "WOLF" } },
      });
      if (wolfRoom) {
        await ctx.db.post.create({
          data: {
            content: wolfAttackSetMessage(
              player.username,
              target.username,
            ),
            day: village.day,
            owner: "SYSTEM",
            roomId: wolfRoom.id,
          },
        });
      }

      return ctx.db.record.update({
        where: { id: record.id },
        data: { attackTargetId: input.targetPlayerId },
      });
    }),

  divine: protectedProcedure
    .input(actionSchema)
    .mutation(async ({ ctx, input }) => {
      const { record, village } = await resolveRecord(
        ctx,
        input.villageId,
        Role.FORTUNE_TELLER,
      );

      if (record.playerId === input.targetPlayerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "自分自身は占えません",
        });
      }

      await assertTargetAlive(ctx, input.targetPlayerId, village.id);

      return ctx.db.record.update({
        where: { id: record.id },
        data: { divineTargetId: input.targetPlayerId },
      });
    }),

  guard: protectedProcedure
    .input(actionSchema)
    .mutation(async ({ ctx, input }) => {
      const { record, village } = await resolveRecord(
        ctx,
        input.villageId,
        Role.BODYGUARD,
      );

      if (record.playerId === input.targetPlayerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "自分自身は護衛できません",
        });
      }

      await assertTargetAlive(ctx, input.targetPlayerId, village.id);

      return ctx.db.record.update({
        where: { id: record.id },
        data: { guardTargetId: input.targetPlayerId },
      });
    }),

  divineResults: protectedProcedure
    .input(gameStateSchema)
    .query(async ({ ctx, input }) => {
      const player = await getPlayerForUser(ctx, input.villageId);
      if (!player || player.role !== Role.FORTUNE_TELLER) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "占い師のみが閲覧できます",
        });
      }

      const results = await ctx.db.result.findMany({
        where: {
          villageId: input.villageId,
          divinedPlayerId: { not: null },
        },
        include: {
          divinedPlayer: { select: { username: true, role: true } },
        },
        orderBy: { day: "asc" },
      });

      return results
        .filter((r) => r.divinedPlayer !== null)
        .map((r) => ({
          day: r.day,
          targetUsername: r.divinedPlayer!.username,
          isWerewolf: r.divinedPlayer!.role === Role.WEREWOLF,
        }));
    }),

  psychicResults: protectedProcedure
    .input(gameStateSchema)
    .query(async ({ ctx, input }) => {
      const player = await getPlayerForUser(ctx, input.villageId);
      if (!player || player.role !== Role.PSYCHIC) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "霊媒師のみが閲覧できます",
        });
      }

      const results = await ctx.db.result.findMany({
        where: {
          villageId: input.villageId,
          votedPlayerId: { not: null },
        },
        include: {
          votedPlayer: { select: { username: true, role: true } },
        },
        orderBy: { day: "asc" },
      });

      return results
        .filter((r) => r.votedPlayer !== null)
        .map((r) => ({
          day: r.day,
          targetUsername: r.votedPlayer!.username,
          isWerewolf: r.votedPlayer!.role === Role.WEREWOLF,
        }));
    }),

  posts: publicProcedure.input(postsSchema).query(async ({ ctx, input }) => {
    const room = await ctx.db.room.findUnique({
      where: { id: input.roomId },
      include: { village: { select: { id: true, status: true } } },
    });
    if (!room) {
      throw new TRPCError({ code: "NOT_FOUND", message: "ルームが見つかりません" });
    }

    // Room access check for non-MAIN rooms during game
    const isGameEnded =
      room.village.status === "ENDED" || room.village.status === "RUINED";

    if (!isGameEnded && room.type !== "MAIN") {
      const authUser = ctx.user;
      if (!authUser) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const player = await ctx.db.player.findFirst({
        where: {
          villageId: room.village.id,
          user: { authId: authUser.id },
        },
      });
      if (room.type === "WOLF" && player?.role !== Role.WEREWOLF) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (room.type === "DEAD" && player?.status !== "DEAD") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
    }

    const where: { roomId: string; day?: number } = { roomId: input.roomId };
    if (input.day !== undefined) {
      where.day = input.day;
    }

    const posts = await ctx.db.post.findMany({
      where,
      include: {
        player: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return posts.map((p) => ({
      id: p.id,
      content: p.content,
      day: p.day,
      owner: p.owner,
      createdAt: p.createdAt,
      player: p.player
        ? { id: p.player.id, username: p.player.username }
        : null,
    }));
  }),

  proceed: protectedProcedure
    .input(gameStateSchema)
    .mutation(async ({ ctx, input }) => {
      const village = await ctx.db.village.findUnique({
        where: { id: input.villageId },
        select: { id: true, status: true, nextUpdateTime: true },
      });
      if (
        !village ||
        village.status !== "IN_PLAY" ||
        !village.nextUpdateTime ||
        village.nextUpdateTime > new Date()
      ) {
        return { proceeded: false };
      }
      await proceedDay(village.id);
      return { proceeded: true };
    }),

  sendMessage: protectedProcedure
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.room.findUnique({
        where: { id: input.roomId },
        include: {
          village: { select: { id: true, day: true, status: true } },
        },
      });
      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ルームが見つかりません" });
      }

      if (room.village.status !== "IN_PLAY") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ゲーム中のみ発言できます",
        });
      }

      const player = await ctx.db.player.findFirst({
        where: {
          villageId: room.village.id,
          user: { authId: ctx.user.id },
        },
      });
      if (!player) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "参加者のみ発言できます",
        });
      }

      // Speak permission check
      if (room.type === "MAIN" && player.status !== "ALIVE") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "生存者のみ発言できます",
        });
      }
      if (room.type === "WOLF") {
        if (player.role !== Role.WEREWOLF || player.status !== "ALIVE") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "生存中の人狼のみ発言できます",
          });
        }
      }
      if (room.type === "DEAD" && player.status !== "DEAD") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "死亡者のみ発言できます",
        });
      }

      return ctx.db.post.create({
        data: {
          content: input.content,
          day: room.village.day,
          owner: "PLAYER",
          playerId: player.id,
          roomId: room.id,
        },
      });
    }),
});

// ── Helpers ──

type TxContext = {
  db: (typeof import("@/server/db"))["db"];
  user: { id: string };
  dbUser: { id: string };
};

async function getPlayerForUser(ctx: TxContext, villageId: string) {
  return ctx.db.player.findFirst({
    where: {
      villageId,
      user: { authId: ctx.user.id },
    },
  });
}

async function resolveRecord(
  ctx: TxContext,
  villageId: string,
  requiredRole: Role | null,
) {
  const village = await ctx.db.village.findUnique({
    where: { id: villageId },
    select: { id: true, day: true, status: true },
  });
  if (!village || village.status !== "IN_PLAY") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "ゲーム進行中の村でのみ実行できます",
    });
  }

  const player = await ctx.db.player.findFirst({
    where: {
      villageId,
      user: { authId: ctx.user.id },
    },
  });
  if (!player) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "参加者のみ実行できます",
    });
  }
  if (player.status !== "ALIVE") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "生存者のみ実行できます",
    });
  }
  if (requiredRole && player.role !== requiredRole) {
    throw new TRPCError({ code: "FORBIDDEN", message: "権限がありません" });
  }

  const record = await ctx.db.record.findUnique({
    where: {
      playerId_villageId_day: {
        playerId: player.id,
        villageId,
        day: village.day,
      },
    },
  });
  if (!record) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "レコードが見つかりません",
    });
  }

  return { record, player, village };
}

async function assertTargetAlive(
  ctx: TxContext,
  targetPlayerId: string,
  villageId: string,
) {
  const target = await ctx.db.player.findFirst({
    where: { id: targetPlayerId, villageId, status: "ALIVE" },
  });
  if (!target) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "対象プレイヤーが見つかりません",
    });
  }
  return target;
}
