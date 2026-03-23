import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockTransaction, mockBroadcastGameUpdate } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockBroadcastGameUpdate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("@/server/game/broadcast", () => ({
  broadcastGameUpdate: (...args: unknown[]) => mockBroadcastGameUpdate(...args),
}));

import { proceedDay } from "@/server/game/proceed-day";

type Role =
  | "VILLAGER"
  | "WEREWOLF"
  | "FORTUNE_TELLER"
  | "BODYGUARD"
  | "PSYCHIC"
  | "MADMAN";

type Player = {
  id: string;
  username: string;
  role: Role;
  status: "ALIVE" | "DEAD";
};

type RecordTarget = {
  voteTargetId?: string | null;
  divineTargetId?: string | null;
  guardTargetId?: string | null;
  attackTargetId?: string | null;
  updatedAt?: Date;
};

function createPlayer(id: string, role: Role): Player {
  return {
    id,
    username: id,
    role,
    status: "ALIVE",
  };
}

function createRecord(
  player: Player,
  allPlayers: Player[],
  day: number,
  targets: RecordTarget = {},
) {
  const voteTarget = targets.voteTargetId
    ? allPlayers.find((candidate) => candidate.id === targets.voteTargetId) ?? null
    : null;

  return {
    id: `record-${player.id}`,
    day,
    playerId: player.id,
    villageId: "village-1",
    voteTargetId: targets.voteTargetId ?? null,
    divineTargetId: targets.divineTargetId ?? null,
    guardTargetId: targets.guardTargetId ?? null,
    attackTargetId: targets.attackTargetId ?? null,
    createdAt: new Date("2026-03-15T00:00:00.000Z"),
    updatedAt: targets.updatedAt ?? new Date("2026-03-15T00:00:00.000Z"),
    player: { ...player },
    voteTarget: voteTarget
      ? { id: voteTarget.id, username: voteTarget.username }
      : null,
  };
}

function setupProceedDayScenario(players: Player[], records: ReturnType<typeof createRecord>[]) {
  const playerState = players.map((player) => ({ ...player }));
  const resultState = {
    id: "result-2",
    villageId: "village-1",
    day: 2,
    votedPlayerId: null as string | null,
    attackedPlayerId: null as string | null,
    divinedPlayerId: null as string | null,
    guardedPlayerId: null as string | null,
  };

  const mockPlayerFindMany = vi.fn().mockImplementation(async (args?: { where?: { status?: "ALIVE" } }) => {
    if (args?.where?.status === "ALIVE") {
      return playerState.filter((player) => player.status === "ALIVE");
    }

    return playerState;
  });

  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([
      {
        id: "village-1",
        day: 2,
        status: "IN_PLAY",
        discussion_time: 300,
        show_vote_target: true,
        next_update_time: new Date("2026-03-14T23:59:00.000Z"),
      },
    ]),
    player: {
      findMany: mockPlayerFindMany,
      update: vi.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: { status: "ALIVE" | "DEAD" } }) => {
        const target = playerState.find((player) => player.id === where.id);
        if (!target) {
          throw new Error(`player not found: ${where.id}`);
        }
        target.status = data.status;
        return { ...target };
      }),
    },
    record: {
      findMany: vi.fn().mockResolvedValue(records),
      createMany: vi.fn().mockResolvedValue({ count: playerState.filter((player) => player.status === "ALIVE").length }),
    },
    room: {
      findUnique: vi.fn().mockResolvedValue({ id: "room-main", villageId: "village-1", type: "MAIN" }),
    },
    post: {
      create: vi.fn().mockResolvedValue({ id: "post-1" }),
    },
    result: {
      findUnique: vi.fn().mockResolvedValue({ ...resultState }),
      update: vi.fn().mockImplementation(async ({ data }: { data: Partial<typeof resultState> }) => {
        Object.assign(resultState, data);
        return { ...resultState };
      }),
      create: vi.fn().mockResolvedValue({ id: "result-3" }),
    },
    village: {
      update: vi.fn().mockResolvedValue({ id: "village-1" }),
    },
  };

  mockTransaction.mockImplementation(async (callback: (client: typeof tx) => Promise<boolean | void>) =>
    callback(tx),
  );
  mockBroadcastGameUpdate.mockResolvedValue(undefined);

  return { tx, resultState, playerState };
}

describe("proceedDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("処刑された占い師の占い結果を夜フェーズで採用しない", async () => {
    const players = [
      createPlayer("seer", "FORTUNE_TELLER"),
      createPlayer("wolf", "WEREWOLF"),
      createPlayer("villager-a", "VILLAGER"),
      createPlayer("villager-b", "VILLAGER"),
      createPlayer("villager-c", "VILLAGER"),
    ];
    const records = [
      createRecord(players[0], players, 2, {
        voteTargetId: "seer",
        divineTargetId: "wolf",
      }),
      createRecord(players[1], players, 2, {
        voteTargetId: "seer",
        attackTargetId: "villager-a",
        updatedAt: new Date("2026-03-15T00:00:05.000Z"),
      }),
      createRecord(players[2], players, 2, { voteTargetId: "seer" }),
      createRecord(players[3], players, 2, { voteTargetId: "villager-b" }),
      createRecord(players[4], players, 2, { voteTargetId: "villager-b" }),
    ];

    const { resultState } = setupProceedDayScenario(players, records);

    await proceedDay("village-1");

    expect(resultState.votedPlayerId).toBe("seer");
    expect(resultState.divinedPlayerId).toBeNull();
  });

  test("処刑された騎士の護衛は夜襲を防がない", async () => {
    const players = [
      createPlayer("guard", "BODYGUARD"),
      createPlayer("wolf", "WEREWOLF"),
      createPlayer("villager-a", "VILLAGER"),
      createPlayer("villager-b", "VILLAGER"),
      createPlayer("villager-c", "VILLAGER"),
    ];
    const records = [
      createRecord(players[0], players, 2, {
        voteTargetId: "guard",
        guardTargetId: "villager-a",
      }),
      createRecord(players[1], players, 2, {
        voteTargetId: "guard",
        attackTargetId: "villager-a",
        updatedAt: new Date("2026-03-15T00:00:05.000Z"),
      }),
      createRecord(players[2], players, 2, { voteTargetId: "guard" }),
      createRecord(players[3], players, 2, { voteTargetId: "villager-b" }),
      createRecord(players[4], players, 2, { voteTargetId: "villager-b" }),
    ];

    const { resultState, playerState } = setupProceedDayScenario(players, records);

    await proceedDay("village-1");

    expect(resultState.votedPlayerId).toBe("guard");
    expect(resultState.guardedPlayerId).toBeNull();
    expect(resultState.attackedPlayerId).toBe("villager-a");
    expect(playerState.find((player) => player.id === "villager-a")?.status).toBe("DEAD");
  });

  test("処刑された人狼の襲撃先は夜フェーズで無視される", async () => {
    const players = [
      createPlayer("wolf-dead", "WEREWOLF"),
      createPlayer("wolf-alive", "WEREWOLF"),
      createPlayer("villager-a", "VILLAGER"),
      createPlayer("villager-b", "VILLAGER"),
      createPlayer("villager-c", "VILLAGER"),
    ];
    const records = [
      createRecord(players[0], players, 2, {
        voteTargetId: "wolf-dead",
        attackTargetId: "villager-a",
        updatedAt: new Date("2026-03-15T00:00:10.000Z"),
      }),
      createRecord(players[1], players, 2, {
        voteTargetId: "wolf-dead",
        attackTargetId: "villager-b",
        updatedAt: new Date("2026-03-15T00:00:05.000Z"),
      }),
      createRecord(players[2], players, 2, { voteTargetId: "wolf-dead" }),
      createRecord(players[3], players, 2, { voteTargetId: "villager-c" }),
      createRecord(players[4], players, 2, { voteTargetId: "villager-c" }),
    ];

    const { resultState, playerState } = setupProceedDayScenario(players, records);

    await proceedDay("village-1");

    expect(resultState.votedPlayerId).toBe("wolf-dead");
    expect(resultState.attackedPlayerId).toBe("villager-b");
    expect(playerState.find((player) => player.id === "villager-a")?.status).toBe("ALIVE");
    expect(playerState.find((player) => player.id === "villager-b")?.status).toBe("DEAD");
  });

  test("処刑されたプレイヤーへの襲撃は無効になる", async () => {
    const players = [
      createPlayer("wolf", "WEREWOLF"),
      createPlayer("villager-a", "VILLAGER"),
      createPlayer("villager-b", "VILLAGER"),
      createPlayer("villager-c", "VILLAGER"),
      createPlayer("villager-d", "VILLAGER"),
    ];
    const records = [
      createRecord(players[0], players, 2, {
        voteTargetId: "villager-a",
        attackTargetId: "villager-a",
        updatedAt: new Date("2026-03-15T00:00:05.000Z"),
      }),
      createRecord(players[1], players, 2, { voteTargetId: "villager-a" }),
      createRecord(players[2], players, 2, { voteTargetId: "villager-a" }),
      createRecord(players[3], players, 2, { voteTargetId: "villager-b" }),
      createRecord(players[4], players, 2, { voteTargetId: "villager-b" }),
    ];

    const { resultState, playerState } = setupProceedDayScenario(players, records);

    await proceedDay("village-1");

    // villager-a は処刑で死亡
    expect(resultState.votedPlayerId).toBe("villager-a");
    // 襲撃対象が処刑済みのため襲撃は無効
    expect(resultState.attackedPlayerId).toBeNull();
    // 処刑以外での死者はいない
    const deadPlayers = playerState.filter((p) => p.status === "DEAD");
    expect(deadPlayers).toHaveLength(1);
    expect(deadPlayers[0].id).toBe("villager-a");
  });

  test("村が存在しないときはブロードキャストしない", async () => {
    const players = [createPlayer("p1", "VILLAGER")];
    const { tx } = setupProceedDayScenario(players, []);
    tx.$queryRaw.mockResolvedValueOnce([]);

    await proceedDay("village-1");

    expect(mockBroadcastGameUpdate).not.toHaveBeenCalled();
  });

  test("next_update_time が未到来のときはブロードキャストしない", async () => {
    const players = [createPlayer("p1", "VILLAGER")];
    const { tx } = setupProceedDayScenario(players, []);
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: "village-1",
        day: 1,
        status: "IN_PLAY",
        discussion_time: 300,
        show_vote_target: true,
        next_update_time: new Date("2099-01-01T00:00:00.000Z"),
      },
    ]);

    await proceedDay("village-1");

    expect(mockBroadcastGameUpdate).not.toHaveBeenCalled();
  });

  test("進行が完了したときだけブロードキャストする", async () => {
    const players = [
      createPlayer("seer", "FORTUNE_TELLER"),
      createPlayer("wolf", "WEREWOLF"),
      createPlayer("villager-a", "VILLAGER"),
      createPlayer("villager-b", "VILLAGER"),
      createPlayer("villager-c", "VILLAGER"),
    ];
    const records = [
      createRecord(players[0], players, 2, {
        voteTargetId: "seer",
        divineTargetId: "wolf",
      }),
      createRecord(players[1], players, 2, {
        voteTargetId: "seer",
        attackTargetId: "villager-a",
        updatedAt: new Date("2026-03-15T00:00:05.000Z"),
      }),
      createRecord(players[2], players, 2, { voteTargetId: "seer" }),
      createRecord(players[3], players, 2, { voteTargetId: "villager-b" }),
      createRecord(players[4], players, 2, { voteTargetId: "villager-b" }),
    ];

    setupProceedDayScenario(players, records);

    await proceedDay("village-1");

    expect(mockBroadcastGameUpdate).toHaveBeenCalledTimes(1);
    expect(mockBroadcastGameUpdate).toHaveBeenCalledWith("village-1");
  });
});
