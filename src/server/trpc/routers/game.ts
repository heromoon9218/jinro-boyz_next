import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/server/trpc/init";
import {
  gameStateSchema,
  gameActionSchema,
  sendMessageSchema,
  messagesSchema,
} from "@/lib/validators/game";
import { proceedDay } from "@/server/game/proceed-day";

// Simple in-memory rate limiter for triggerProceed (per village, 5s cooldown).
// Entries are cleaned up when expired or when the village is no longer IN_PLAY.
const proceedCooldowns = new Map<string, number>();
const PROCEED_COOLDOWN_MS = 5_000;
const PROCEED_CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupCooldowns() {
  const now = Date.now();
  if (now - lastCleanup < PROCEED_CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, timestamp] of proceedCooldowns) {
    if (now - timestamp > PROCEED_COOLDOWN_MS) {
      proceedCooldowns.delete(key);
    }
  }
}

export const gameRouter = createTRPCRouter({
  /**
   * Get the full game state for the current player.
   * Returns role, players, rooms, current record, and role-specific info.
   */
  state: protectedProcedure
    .input(gameStateSchema)
    .query(async ({ ctx, input }) => {
      const { dbUser } = ctx;

      const village = await ctx.db.village.findUnique({
        where: { id: input.villageId },
        select: {
          id: true,
          name: true,
          day: true,
          status: true,
          winner: true,
          nextUpdateTime: true,
          showVoteTarget: true,
          discussionTime: true,
          rooms: { select: { id: true, type: true } },
          players: {
            select: {
              id: true,
              username: true,
              role: true,
              status: true,
              userId: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!village) {
        throw new TRPCError({ code: "NOT_FOUND", message: "村が見つかりません" });
      }

      if (village.status !== "IN_PLAY" && village.status !== "ENDED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ゲームが開始されていません",
        });
      }

      const myPlayer = village.players.find((p) => p.userId === dbUser.id);
      if (!myPlayer) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "この村に参加していません",
        });
      }

      // Current day record (may not exist if ENDED)
      const myRecord = await ctx.db.record.findUnique({
        where: {
          playerId_villageId_day: {
            playerId: myPlayer.id,
            villageId: input.villageId,
            day: village.day,
          },
        },
        select: {
          voteTargetId: true,
          attackTargetId: true,
          divineTargetId: true,
          guardTargetId: true,
        },
      });

      // Role-specific data
      let divineResults: {
        day: number;
        targetId: string;
        targetName: string;
        isWerewolf: boolean;
      }[] = [];

      if (myPlayer.role === "FORTUNE_TELLER") {
        // Result.divinedPlayerId は proceedDay の夜解決と一致する（処刑で占い師が
        // nightRecords から外れた日は null のまま）。record.divineTargetId だけでは
        // 未実行の選択が残り得るため、ここでは Result を正とする。
        const pastResults = await ctx.db.result.findMany({
          where: {
            villageId: input.villageId,
            day: { lt: village.day },
            divinedPlayerId: { not: null },
          },
          include: {
            divinedPlayer: {
              select: { id: true, username: true, role: true },
            },
          },
          orderBy: { day: "asc" },
        });

        divineResults = pastResults
          .filter((r) => r.divinedPlayer)
          .map((r) => ({
            day: r.day,
            targetId: r.divinedPlayer!.id,
            targetName: r.divinedPlayer!.username,
            isWerewolf: r.divinedPlayer!.role === "WEREWOLF",
          }));
      }

      let psychicResults: {
        day: number;
        targetId: string;
        targetName: string;
        isWerewolf: boolean;
      }[] = [];

      if (myPlayer.role === "PSYCHIC") {
        const pastResults = await ctx.db.result.findMany({
          where: {
            villageId: input.villageId,
            day: { lt: village.day },
            votedPlayerId: { not: null },
          },
          include: {
            votedPlayer: {
              select: { id: true, username: true, role: true },
            },
          },
          orderBy: { day: "asc" },
        });

        psychicResults = pastResults
          .filter((r) => r.votedPlayer)
          .map((r) => ({
            day: r.day,
            targetId: r.votedPlayer!.id,
            targetName: r.votedPlayer!.username,
            isWerewolf: r.votedPlayer!.role === "WEREWOLF",
          }));
      }

      return {
        villageId: village.id,
        villageName: village.name,
        villageStatus: village.status,
        day: village.day,
        nextUpdateTime: village.nextUpdateTime,
        showVoteTarget: village.showVoteTarget,
        discussionTime: village.discussionTime,
        winner: village.winner,
        myPlayerId: myPlayer.id,
        myRole: myPlayer.role,
        myStatus: myPlayer.status,
        rooms: village.rooms.map((r) => ({ id: r.id, type: r.type })),
        players: village.players.map((p) => ({
          id: p.id,
          username: p.username,
          status: p.status,
          isMe: p.id === myPlayer.id,
        })),
        myRecord: myRecord ?? null,
        divineResults,
        psychicResults,
      };
    }),

  /**
   * Get paginated messages for a specific room.
   * Access control: MAIN=all participants, WOLF=werewolves only, DEAD=dead only.
   */
  messages: protectedProcedure
    .input(messagesSchema)
    .query(async ({ ctx, input }) => {
      const { dbUser } = ctx;

      const room = await ctx.db.room.findUnique({
        where: { id: input.roomId },
        select: {
          id: true,
          type: true,
          villageId: true,
        },
      });

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ルームが見つかりません" });
      }

      const myPlayer = await ctx.db.player.findUnique({
        where: {
          userId_villageId: { userId: dbUser.id, villageId: room.villageId },
        },
        select: { id: true, role: true, status: true },
      });

      if (!myPlayer) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "この村に参加していません",
        });
      }

      // Access control for reading
      if (room.type === "WOLF" && myPlayer.role !== "WEREWOLF") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "人狼ルームにアクセスできません",
        });
      }
      if (room.type === "DEAD" && myPlayer.status !== "DEAD") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "霊界ルームにアクセスできません",
        });
      }

      const posts = await ctx.db.post.findMany({
        where: {
          roomId: input.roomId,
          ...(input.cursor
            ? {
                OR: [
                  {
                    createdAt: {
                      lt: new Date(input.cursor.createdAt),
                    },
                  },
                  {
                    createdAt: new Date(input.cursor.createdAt),
                    id: { lt: input.cursor.id },
                  },
                ],
              }
            : {}),
        },
        include: {
          player: { select: { id: true, username: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
      });

      const pagePosts = posts.slice(0, input.limit);
      const nextCursor =
        posts.length > input.limit
          ? {
              createdAt: pagePosts[pagePosts.length - 1]!.createdAt.toISOString(),
              id: pagePosts[pagePosts.length - 1]!.id,
            }
          : null;

      return {
        items: pagePosts.toReversed().map((p) => ({
          id: p.id,
          content: p.content,
          day: p.day,
          owner: p.owner,
          player: p.player
            ? { id: p.player.id, username: p.player.username }
            : null,
          createdAt: p.createdAt,
        })),
        nextCursor,
      };
    }),

  /**
   * Get game results (only available after game ends).
   * Returns all player roles and day-by-day result history.
   */
  results: publicProcedure
    .input(gameStateSchema)
    .query(async ({ ctx, input }) => {
      const village = await ctx.db.village.findUnique({
        where: { id: input.villageId },
        select: { status: true, winner: true, name: true },
      });

      if (!village) {
        throw new TRPCError({ code: "NOT_FOUND", message: "村が見つかりません" });
      }

      if (village.status !== "ENDED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ゲームがまだ終了していません",
        });
      }

      if (!village.winner) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "終了済みの村に勝敗情報がありません",
        });
      }

      const winner = village.winner;

      const [players, results] = await Promise.all([
        ctx.db.player.findMany({
          where: { villageId: input.villageId },
          select: { id: true, username: true, role: true, status: true },
          orderBy: { createdAt: "asc" },
        }),
        ctx.db.result.findMany({
          where: { villageId: input.villageId },
          include: {
            votedPlayer: { select: { id: true, username: true } },
            attackedPlayer: { select: { id: true, username: true } },
          },
          orderBy: { day: "asc" },
        }),
      ]);

      return {
        villageName: village.name,
        winner,
        players: players.map((p) => ({
          id: p.id,
          username: p.username,
          role: p.role,
          status: p.status,
        })),
        results: results.map((r) => ({
          day: r.day,
          votedPlayer: r.votedPlayer
            ? { id: r.votedPlayer.id, username: r.votedPlayer.username }
            : null,
          attackedPlayer: r.attackedPlayer
            ? { id: r.attackedPlayer.id, username: r.attackedPlayer.username }
            : null,
        })),
      };
    }),

  /**
   * Submit a vote target.
   */
  vote: protectedProcedure
    .input(gameActionSchema)
    .mutation(async ({ ctx, input }) => {
      const { myPlayer, village } = await resolveGameContext(
        ctx,
        input.villageId,
      );

      validateTarget(
        input.targetPlayerId,
        myPlayer.id,
        village.players,
      );

      await ctx.db.record.update({
        where: {
          playerId_villageId_day: {
            playerId: myPlayer.id,
            villageId: input.villageId,
            day: village.day,
          },
        },
        data: { voteTargetId: input.targetPlayerId },
      });

      return { success: true };
    }),

  /**
   * Submit an attack target (WEREWOLF only).
   */
  attack: protectedProcedure
    .input(gameActionSchema)
    .mutation(async ({ ctx, input }) => {
      const { myPlayer, village } = await resolveGameContext(
        ctx,
        input.villageId,
      );

      if (myPlayer.role !== "WEREWOLF") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "人狼のみが襲撃できます",
        });
      }

      // Target must not be a werewolf
      const target = village.players.find(
        (p) => p.id === input.targetPlayerId,
      );
      if (!target || target.status !== "ALIVE" || target.role === "WEREWOLF") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "無効な襲撃対象です",
        });
      }

      await ctx.db.record.update({
        where: {
          playerId_villageId_day: {
            playerId: myPlayer.id,
            villageId: input.villageId,
            day: village.day,
          },
        },
        data: { attackTargetId: input.targetPlayerId },
      });

      return { success: true };
    }),

  /**
   * Submit a divine target (FORTUNE_TELLER only).
   */
  divine: protectedProcedure
    .input(gameActionSchema)
    .mutation(async ({ ctx, input }) => {
      const { myPlayer, village } = await resolveGameContext(
        ctx,
        input.villageId,
      );

      if (myPlayer.role !== "FORTUNE_TELLER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "占い師のみが占えます",
        });
      }

      validateTarget(
        input.targetPlayerId,
        myPlayer.id,
        village.players,
      );

      await ctx.db.record.update({
        where: {
          playerId_villageId_day: {
            playerId: myPlayer.id,
            villageId: input.villageId,
            day: village.day,
          },
        },
        data: { divineTargetId: input.targetPlayerId },
      });

      return { success: true };
    }),

  /**
   * Submit a guard target (BODYGUARD only).
   */
  guard: protectedProcedure
    .input(gameActionSchema)
    .mutation(async ({ ctx, input }) => {
      const { myPlayer, village } = await resolveGameContext(
        ctx,
        input.villageId,
      );

      if (myPlayer.role !== "BODYGUARD") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "騎士のみが守護できます",
        });
      }

      validateTarget(
        input.targetPlayerId,
        myPlayer.id,
        village.players,
      );

      await ctx.db.record.update({
        where: {
          playerId_villageId_day: {
            playerId: myPlayer.id,
            villageId: input.villageId,
            day: village.day,
          },
        },
        data: { guardTargetId: input.targetPlayerId },
      });

      return { success: true };
    }),

  /**
   * Send a chat message to a room.
   * Access: MAIN=alive, WOLF=alive werewolves, DEAD=dead players.
   */
  sendMessage: protectedProcedure
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const { dbUser } = ctx;

      const room = await ctx.db.room.findUnique({
        where: { id: input.roomId },
        select: { id: true, type: true, villageId: true },
      });

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ルームが見つかりません" });
      }

      const village = await ctx.db.village.findUnique({
        where: { id: room.villageId },
        select: { status: true, day: true },
      });

      if (!village || village.status !== "IN_PLAY") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ゲーム中のみメッセージを送信できます",
        });
      }

      const myPlayer = await ctx.db.player.findUnique({
        where: {
          userId_villageId: { userId: dbUser.id, villageId: room.villageId },
        },
        select: { id: true, role: true, status: true },
      });

      if (!myPlayer) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "この村に参加していません",
        });
      }

      // Posting access control
      if (room.type === "MAIN" && myPlayer.status !== "ALIVE") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "生存者のみがメインルームに投稿できます",
        });
      }
      if (
        room.type === "WOLF" &&
        (myPlayer.role !== "WEREWOLF" || myPlayer.status !== "ALIVE")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "生存中の人狼のみが人狼ルームに投稿できます",
        });
      }
      if (room.type === "DEAD" && myPlayer.status !== "DEAD") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "死亡者のみが霊界ルームに投稿できます",
        });
      }

      const post = await ctx.db.post.create({
        data: {
          content: input.content,
          day: village.day,
          owner: "PLAYER",
          playerId: myPlayer.id,
          roomId: input.roomId,
        },
      });

      return { id: post.id };
    }),

  /**
   * Client-side trigger for day progression.
   * Re-verifies that nextUpdateTime has passed before calling proceedDay.
   */
  triggerProceed: protectedProcedure
    .input(gameStateSchema)
    .mutation(async ({ ctx, input }) => {
      // Rate limit: skip if this village was triggered recently
      cleanupCooldowns();
      const now = Date.now();
      const lastTriggered = proceedCooldowns.get(input.villageId) ?? 0;
      if (now - lastTriggered < PROCEED_COOLDOWN_MS) {
        return { triggered: false };
      }
      proceedCooldowns.set(input.villageId, now);

      const village = await ctx.db.village.findUnique({
        where: { id: input.villageId },
        select: { status: true, nextUpdateTime: true },
      });

      if (!village || village.status !== "IN_PLAY" || !village.nextUpdateTime) {
        proceedCooldowns.delete(input.villageId);
        return { triggered: false };
      }

      if (village.nextUpdateTime > new Date()) {
        return { triggered: false };
      }

      await proceedDay(input.villageId);
      return { triggered: true };
    }),
});

// ============================================================
// Helper functions
// ============================================================

type GameContext = Awaited<
  ReturnType<typeof import("@/server/trpc/init").createTRPCContext>
> & {
  dbUser: { id: string };
};

async function resolveGameContext(ctx: GameContext, villageId: string) {
  const village = await ctx.db.village.findUnique({
    where: { id: villageId },
    select: {
      status: true,
      day: true,
      players: {
        select: {
          id: true,
          username: true,
          role: true,
          status: true,
          userId: true,
        },
      },
    },
  });

  if (!village || village.status !== "IN_PLAY") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "ゲームが進行中ではありません",
    });
  }

  const myPlayer = village.players.find((p) => p.userId === ctx.dbUser.id);
  if (!myPlayer) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "この村に参加していません",
    });
  }

  if (myPlayer.status !== "ALIVE") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "死亡者はアクションを実行できません",
    });
  }

  return { village, myPlayer };
}

function validateTarget(
  targetPlayerId: string,
  myPlayerId: string,
  players: { id: string; status: string; userId: string }[],
) {
  if (targetPlayerId === myPlayerId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "自分自身を対象にできません",
    });
  }

  const target = players.find((p) => p.id === targetPlayerId);
  if (!target || target.status !== "ALIVE") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "無効な対象です",
    });
  }
}
