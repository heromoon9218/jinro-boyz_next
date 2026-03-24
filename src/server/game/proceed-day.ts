import { Prisma, Role, type PlayerStatus } from "@/generated/prisma";
import { db } from "@/server/db";
import { determineLynchTarget } from "./lynch";
import { resolveAttack } from "./attack";
import { judgeEnd } from "./judge";
import {
  voteResultMessage,
  noVoteMessage,
  morningMessage,
  gameEndMessage,
} from "./system-messages";

export async function proceedDay(villageId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    // Lock village row
    const locked = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM villages WHERE id = ${villageId} FOR UPDATE`,
    );
    if (locked.length === 0) return;

    const village = await tx.village.findUnique({
      where: { id: villageId },
      include: {
        players: true,
        rooms: true,
      },
    });
    if (!village || village.status !== "IN_PLAY") return;

    const currentDay = village.day;
    const mainRoom = village.rooms.find((r) => r.type === "MAIN");
    if (!mainRoom) return;

    // Records for today (only alive players' actions matter)
    const alivePlayers = village.players.filter((p) => p.status === "ALIVE");
    const alivePlayerIds = alivePlayers.map((p) => p.id);

    const records = await tx.record.findMany({
      where: { villageId, day: currentDay, playerId: { in: alivePlayerIds } },
    });

    // Player lookup
    const playerMap = new Map(village.players.map((p) => [p.id, p]));

    // ── NOON: Resolve votes ──
    const votes = records
      .filter((r) => r.voteTargetId !== null)
      .map((r) => ({ voterId: r.playerId, targetId: r.voteTargetId! }));

    const lynchTargetId = determineLynchTarget(votes, alivePlayerIds);
    const lynchPlayer = playerMap.get(lynchTargetId);

    // Execute lynch
    await tx.player.update({
      where: { id: lynchTargetId },
      data: { status: "DEAD" as PlayerStatus },
    });

    // Post vote result
    if (votes.length > 0) {
      const voteInfos = votes.map((v) => ({
        voterName: playerMap.get(v.voterId)?.username ?? "",
        targetName: playerMap.get(v.targetId)?.username ?? "",
      }));
      await tx.post.create({
        data: {
          content: voteResultMessage(
            voteInfos,
            lynchPlayer?.username ?? "",
            village.showVoteTarget,
          ),
          day: currentDay,
          owner: "SYSTEM",
          roomId: mainRoom.id,
        },
      });
    } else {
      await tx.post.create({
        data: {
          content: noVoteMessage(lynchPlayer?.username ?? ""),
          day: currentDay,
          owner: "SYSTEM",
          roomId: mainRoom.id,
        },
      });
    }

    // ── Check end after lynch ──
    const livingAfterLynch = alivePlayers
      .filter((p) => p.id !== lynchTargetId)
      .map((p) => ({ id: p.id, role: p.role }));

    const winner1 = judgeEnd(livingAfterLynch);
    if (winner1) {
      await tx.result.create({
        data: {
          day: currentDay,
          villageId,
          votedPlayerId: lynchTargetId,
        },
      });
      await endGame(tx, village, winner1, mainRoom.id, currentDay);
      return;
    }

    // ── NIGHT: Resolve night actions ──
    let attackedPlayerId: string | null = null;
    let divinedPlayerId: string | null = null;
    let guardedPlayerId: string | null = null;

    // Night actions from alive players EXCLUDING the executed player
    const aliveAfterLynchIds = livingAfterLynch.map((p) => p.id);

    // Attack: get werewolf attack targets (only from surviving wolves)
    const wolfRecords = records.filter(
      (r) =>
        aliveAfterLynchIds.includes(r.playerId) &&
        playerMap.get(r.playerId)?.role === Role.WEREWOLF,
    );
    // Pick the most recently updated wolf's attack target (matches Rails: order("updated_at DESC").first)
    const latestWolfAttack = wolfRecords
      .filter((r) => r.attackTargetId !== null)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0];
    let attackTargetId = latestWolfAttack?.attackTargetId ?? null;

    if (!attackTargetId) {
      // No wolf set an attack target — pick a random living human
      const livingHumans = livingAfterLynch.filter(
        (p) => p.role !== Role.WEREWOLF,
      );
      if (livingHumans.length > 0) {
        attackTargetId =
          livingHumans[Math.floor(Math.random() * livingHumans.length)].id;
      }
    } else if (!aliveAfterLynchIds.includes(attackTargetId)) {
      // Attack target was lynched — attack fails (no fallback)
      attackTargetId = null;
    }

    // Guard: get bodyguard target (only from surviving bodyguard)
    const guardRecord = records.find(
      (r) =>
        aliveAfterLynchIds.includes(r.playerId) &&
        playerMap.get(r.playerId)?.role === Role.BODYGUARD,
    );
    guardedPlayerId = guardRecord?.guardTargetId ?? null;

    // Resolve attack
    const killedId = resolveAttack({
      attackTargetId,
      guardTargetId: guardedPlayerId,
    });

    if (killedId) {
      await tx.player.update({
        where: { id: killedId },
        data: { status: "DEAD" as PlayerStatus },
      });
      attackedPlayerId = killedId;
    }

    // Divine: get fortune teller target (only from surviving fortune teller)
    const divineRecord = records.find(
      (r) =>
        aliveAfterLynchIds.includes(r.playerId) &&
        playerMap.get(r.playerId)?.role === Role.FORTUNE_TELLER,
    );
    divinedPlayerId = divineRecord?.divineTargetId ?? null;

    // ── Create Result for today ──
    await tx.result.create({
      data: {
        day: currentDay,
        villageId,
        votedPlayerId: lynchTargetId,
        attackedPlayerId,
        divinedPlayerId,
        guardedPlayerId,
      },
    });

    // ── Check end after night ──
    const livingAfterNight = livingAfterLynch
      .filter((p) => p.id !== attackedPlayerId)
      .map((p) => ({ id: p.id, role: p.role }));

    const winner2 = judgeEnd(livingAfterNight);
    if (winner2) {
      await endGame(tx, village, winner2, mainRoom.id, currentDay);
      return;
    }

    // ── Advance day ──
    const newDay = currentDay + 1;
    const now = new Date();

    await tx.village.update({
      where: { id: villageId },
      data: {
        day: newDay,
        nextUpdateTime: new Date(
          now.getTime() + village.discussionTime * 1000,
        ),
      },
    });

    // Create records for next day (alive players only)
    const livingPlayerIds = livingAfterNight.map((p) => p.id);
    await tx.record.createMany({
      data: livingPlayerIds.map((playerId) => ({
        day: newDay,
        playerId,
        villageId,
      })),
    });

    // Post morning message
    const killedPlayerName = attackedPlayerId
      ? playerMap.get(attackedPlayerId)?.username ?? null
      : null;
    await tx.post.create({
      data: {
        content: morningMessage(newDay, killedPlayerName),
        day: newDay,
        owner: "SYSTEM",
        roomId: mainRoom.id,
      },
    });
  });
}

async function endGame(
  tx: Prisma.TransactionClient,
  village: { id: string; players: { username: string; role: Role }[] },
  winner: "HUMANS" | "WEREWOLVES",
  mainRoomId: string,
  day: number,
): Promise<void> {
  await tx.village.update({
    where: { id: village.id },
    data: { status: "ENDED", winner, nextUpdateTime: null },
  });

  await tx.post.create({
    data: {
      content: gameEndMessage(
        winner,
        village.players.map((p) => ({
          username: p.username,
          role: p.role,
        })),
      ),
      day,
      owner: "SYSTEM",
      roomId: mainRoomId,
    },
  });
}
