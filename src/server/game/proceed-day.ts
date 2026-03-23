import { Prisma } from "@/generated/prisma";
import type { Winner } from "@/generated/prisma";
import { db } from "@/server/db";
import { determineLynchTarget } from "./lynch";
import { resolveAttack } from "./attack";
import { judgeEnd } from "./judge";
import {
  buildNoonMessage,
  buildNightMessage,
  buildMorningMessage,
  buildEndMessage,
  buildRevealMessage,
} from "./messages";
import { broadcastGameUpdate } from "./broadcast";

/**
 * Advance one day for a village.
 * Runs the full day cycle (vote → judge → night actions → judge → next day)
 * in a single transaction, then broadcasts only when state actually changed.
 */
export async function proceedDay(villageId: string): Promise<void> {
  const didMutate = await db.$transaction(async (tx) => {
    // 1. Lock village row and verify it's eligible for processing
    const locked = await tx.$queryRaw<
      {
        id: string;
        day: number;
        status: string;
        discussion_time: number;
        show_vote_target: boolean;
        next_update_time: Date | null;
      }[]
    >(
      Prisma.sql`
        SELECT id, day, status, discussion_time, show_vote_target, next_update_time
        FROM villages
        WHERE id = ${villageId}
        FOR UPDATE
      `,
    );

    if (locked.length === 0) return false;
    const raw = locked[0];

    if (raw.status !== "IN_PLAY") return false;
    if (!raw.next_update_time || raw.next_update_time > new Date()) return false;

    const currentDay = raw.day;
    const showVoteTarget = raw.show_vote_target;
    const discussionTime = raw.discussion_time;

    // 2. Fetch all players and their current-day records
    const allPlayers = await tx.player.findMany({
      where: { villageId },
      select: { id: true, username: true, role: true, status: true },
    });

    const alivePlayers = allPlayers.filter((p) => p.status === "ALIVE");

    const records = await tx.record.findMany({
      where: { villageId, day: currentDay },
      include: {
        player: { select: { id: true, username: true, role: true, status: true } },
        voteTarget: { select: { id: true, username: true } },
      },
    });

    // 3. Get MAIN room for system messages
    const mainRoom = await tx.room.findUnique({
      where: { villageId_type: { villageId, type: "MAIN" } },
    });
    if (!mainRoom) return false;

    // Helper: post system message to MAIN room
    async function postSystemMessage(content: string) {
      await tx.post.create({
        data: {
          content,
          day: currentDay,
          owner: "SYSTEM",
          roomId: mainRoom!.id,
        },
      });
    }

    // Helper: end the game
    async function endGame(winner: Winner) {
      await tx.village.update({
        where: { id: villageId },
        data: { status: "ENDED", winner },
      });

      await postSystemMessage(buildEndMessage({ winner }));
      await postSystemMessage(
        buildRevealMessage({
          players: allPlayers.map((p) => ({
            username: p.username,
            role: p.role,
          })),
        }),
      );
    }

    // ========================================
    // Noon Phase: Vote Resolution
    // ========================================
    const aliveRecords = records.filter(
      (r) => r.player.status === "ALIVE" && r.voteTargetId,
    );
    const votes = aliveRecords.map((r) => ({
      voterId: r.playerId,
      targetId: r.voteTargetId!,
    }));

    const lynchTargetId = determineLynchTarget(votes);

    // Update Result with lynch target
    const result = await tx.result.findUnique({
      where: { villageId_day: { villageId, day: currentDay } },
    });
    if (result) {
      await tx.result.update({
        where: { id: result.id },
        data: { votedPlayerId: lynchTargetId },
      });
    }

    // Execute the lynch
    let lynchTargetName: string | null = null;
    if (lynchTargetId) {
      const lynched = allPlayers.find((p) => p.id === lynchTargetId);
      lynchTargetName = lynched?.username ?? null;
      await tx.player.update({
        where: { id: lynchTargetId },
        data: { status: "DEAD" },
      });
    }

    // Build vote display for system message
    const voteEntries = aliveRecords.map((r) => ({
      voterName: r.player.username,
      targetName: r.voteTarget?.username ?? "???",
    }));

    await postSystemMessage(
      buildNoonMessage({
        votes: voteEntries,
        lynchTargetName,
        showVoteTarget,
      }),
    );

    // ========================================
    // Judge after lynch
    // ========================================
    const aliveAfterLynch = alivePlayers
      .filter((p) => p.id !== lynchTargetId)
      .map((p) => ({ id: p.id, role: p.role }));
    const aliveAfterLynchIds = new Set(aliveAfterLynch.map((p) => p.id));
    const nightRecords = records.filter((r) => aliveAfterLynchIds.has(r.playerId));

    const winnerAfterLynch = judgeEnd(aliveAfterLynch);
    if (winnerAfterLynch) {
      await endGame(winnerAfterLynch);
      return true;
    }

    // ========================================
    // Night Phase: Record divine + guard in Result
    // ========================================
    const fortuneTellerRecord = nightRecords.find(
      (r) => r.player.role === "FORTUNE_TELLER",
    );
    const bodyguardRecord = nightRecords.find(
      (r) => r.player.role === "BODYGUARD",
    );

    if (result) {
      await tx.result.update({
        where: { id: result.id },
        data: {
          divinedPlayerId: fortuneTellerRecord?.divineTargetId ?? null,
          guardedPlayerId: bodyguardRecord?.guardTargetId ?? null,
        },
      });
    }

    // ========================================
    // Night Phase: Werewolf Attack (skip Day 1)
    // ========================================
    let killedName: string | null = null;

    if (currentDay > 1) {
      // Get all alive werewolf records, pick the one with latest updatedAt
      const wolfRecords = nightRecords.filter(
        (r) => r.player.role === "WEREWOLF" && r.attackTargetId,
      );

      let attackTargetId: string | null = null;
      if (wolfRecords.length > 0) {
        // Pick the werewolf record with the latest updatedAt
        const sorted = wolfRecords.sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        );
        attackTargetId = sorted[0].attackTargetId;
      }

      const guardTargetId = bodyguardRecord?.guardTargetId ?? null;
      const killedId = resolveAttack({ attackTargetId, guardTargetId });

      if (killedId) {
        const killed = allPlayers.find((p) => p.id === killedId);
        killedName = killed?.username ?? null;
        await tx.player.update({
          where: { id: killedId },
          data: { status: "DEAD" },
        });

        if (result) {
          await tx.result.update({
            where: { id: result.id },
            data: { attackedPlayerId: killedId },
          });
        }
      }
    }

    await postSystemMessage(
      buildNightMessage({ day: currentDay, killedName }),
    );

    // ========================================
    // Judge after attack
    // ========================================
    if (currentDay > 1) {
      // Re-fetch alive players for accurate judgment
      const currentAlive = await tx.player.findMany({
        where: { villageId, status: "ALIVE" },
        select: { id: true, role: true },
      });

      const winnerAfterAttack = judgeEnd(currentAlive);
      if (winnerAfterAttack) {
        await endGame(winnerAfterAttack);
        return true;
      }
    }

    // ========================================
    // Advance to next day
    // ========================================
    const nextDay = currentDay + 1;
    const now = new Date();

    await tx.village.update({
      where: { id: villageId },
      data: {
        day: nextDay,
        nextUpdateTime: new Date(now.getTime() + discussionTime * 1000),
      },
    });

    // Create Records for all alive players for the new day
    const currentAlivePlayers = await tx.player.findMany({
      where: { villageId, status: "ALIVE" },
      select: { id: true },
    });

    await tx.record.createMany({
      data: currentAlivePlayers.map((p) => ({
        day: nextDay,
        playerId: p.id,
        villageId,
      })),
    });

    // Create Result for the new day
    await tx.result.create({
      data: { day: nextDay, villageId },
    });

    // Morning system message (posted for the new day)
    const survivors = await tx.player.findMany({
      where: { villageId, status: "ALIVE" },
      select: { username: true },
    });

    await tx.post.create({
      data: {
        content: buildMorningMessage({
          day: nextDay,
          survivors: survivors.map((s) => s.username),
        }),
        day: nextDay,
        owner: "SYSTEM",
        roomId: mainRoom.id,
      },
    });

    return true;
  });

  if (didMutate) {
    await broadcastGameUpdate(villageId).catch(() => {
      // Non-critical: don't fail if broadcast fails
    });
  }
}
