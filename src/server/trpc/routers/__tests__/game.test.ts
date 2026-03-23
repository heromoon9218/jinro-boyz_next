import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockFindUniqueUser,
  mockRoomFindUnique,
  mockPlayerFindUnique,
  mockVillageFindUnique,
  mockPlayerFindMany,
  mockResultFindMany,
  mockPostFindMany,
  mockRecordFindUnique,
  mockRecordUpdate,
  mockPostCreate,
} = vi.hoisted(() => ({
  mockFindUniqueUser: vi.fn(),
  mockRoomFindUnique: vi.fn(),
  mockPlayerFindUnique: vi.fn(),
  mockVillageFindUnique: vi.fn(),
  mockPlayerFindMany: vi.fn(),
  mockResultFindMany: vi.fn(),
  mockPostFindMany: vi.fn(),
  mockRecordFindUnique: vi.fn(),
  mockRecordUpdate: vi.fn(),
  mockPostCreate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "auth-user-1" } },
        }),
      },
    }),
  ),
}));

vi.mock("@/server/db", () => ({
  db: {
    user: { findUnique: mockFindUniqueUser },
    village: { findUnique: mockVillageFindUnique },
    room: { findUnique: mockRoomFindUnique },
    player: { findUnique: mockPlayerFindUnique, findMany: mockPlayerFindMany },
    result: { findMany: mockResultFindMany },
    post: { findMany: mockPostFindMany, create: mockPostCreate },
    record: { findUnique: mockRecordFindUnique, update: mockRecordUpdate },
  },
}));

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "../_app";

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller() {
  mockFindUniqueUser.mockResolvedValue({
    id: "db-user-1",
    authId: "auth-user-1",
    username: "user1",
  });

  return createCaller({
    db: {
      user: { findUnique: mockFindUniqueUser },
      village: { findUnique: mockVillageFindUnique },
      room: { findUnique: mockRoomFindUnique },
      player: { findUnique: mockPlayerFindUnique, findMany: mockPlayerFindMany },
      result: { findMany: mockResultFindMany },
      post: { findMany: mockPostFindMany, create: mockPostCreate },
      record: { findUnique: mockRecordFindUnique, update: mockRecordUpdate },
    } as never,
    supabase: {} as never,
    user: { id: "auth-user-1" },
    headers: new Headers(),
  });
}

function createPublicCaller() {
  return createCaller({
    db: {
      user: { findUnique: mockFindUniqueUser },
      village: { findUnique: mockVillageFindUnique },
      room: { findUnique: mockRoomFindUnique },
      player: { findUnique: mockPlayerFindUnique, findMany: mockPlayerFindMany },
      result: { findMany: mockResultFindMany },
      post: { findMany: mockPostFindMany, create: mockPostCreate },
      record: { findUnique: mockRecordFindUnique, update: mockRecordUpdate },
    } as never,
    supabase: {} as never,
    user: null,
    headers: new Headers(),
  });
}

describe("game.messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoomFindUnique.mockResolvedValue({
      id: "room-main",
      type: "MAIN",
      villageId: "village-1",
      village: { status: "IN_PLAY" },
    });
    mockPlayerFindUnique.mockResolvedValue({
      id: "player-1",
      role: "VILLAGER",
      status: "ALIVE",
    });
  });

  test("日をまたぐ投稿を単一タイムラインとしてカーソル取得できる", async () => {
    const caller = await createAuthenticatedCaller();
    const postDay1 = {
      id: "post-1",
      content: "day1 system",
      day: 1,
      owner: "SYSTEM" as const,
      createdAt: new Date("2026-03-15T00:01:00.000Z"),
      player: null,
    };
    const postDay2Vote = {
      id: "post-2",
      content: "day2 vote result",
      day: 2,
      owner: "SYSTEM" as const,
      createdAt: new Date("2026-03-15T00:02:00.000Z"),
      player: null,
    };
    const postDay2Morning = {
      id: "post-3",
      content: "day3 morning",
      day: 3,
      owner: "SYSTEM" as const,
      createdAt: new Date("2026-03-15T00:03:00.000Z"),
      player: null,
    };

    mockPostFindMany
      .mockResolvedValueOnce([postDay2Morning, postDay2Vote, postDay1])
      .mockResolvedValueOnce([postDay1]);

    const firstPage = await caller.game.messages({
      roomId: "room-main",
      limit: 2,
    });

    expect(mockPostFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { roomId: "room-main" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 3,
      }),
    );
    expect(firstPage.items.map((post) => post.id)).toEqual(["post-2", "post-3"]);
    expect(firstPage.items.map((post) => post.day)).toEqual([2, 3]);
    expect(firstPage.nextCursor).toEqual({
      createdAt: postDay2Vote.createdAt.toISOString(),
      id: "post-2",
    });

    const secondPage = await caller.game.messages({
      roomId: "room-main",
      limit: 2,
      cursor: firstPage.nextCursor,
    });

    expect(mockPostFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          roomId: "room-main",
          OR: [
            { createdAt: { lt: postDay2Vote.createdAt } },
            {
              createdAt: postDay2Vote.createdAt,
              id: { lt: "post-2" },
            },
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 3,
      }),
    );
    expect(secondPage.items.map((post) => post.id)).toEqual(["post-1"]);
    expect(secondPage.nextCursor).toBeNull();
  });

  test("同一 createdAt の投稿は id で安定してページングできる", async () => {
    const caller = await createAuthenticatedCaller();
    const sharedCreatedAt = new Date("2026-03-15T00:03:00.000Z");
    const newerSameTimestamp = {
      id: "post-2",
      content: "newer",
      day: 3,
      owner: "SYSTEM" as const,
      createdAt: sharedCreatedAt,
      player: null,
    };
    const olderSameTimestamp = {
      id: "post-1",
      content: "older",
      day: 3,
      owner: "SYSTEM" as const,
      createdAt: sharedCreatedAt,
      player: null,
    };

    mockPostFindMany
      .mockResolvedValueOnce([newerSameTimestamp, olderSameTimestamp])
      .mockResolvedValueOnce([olderSameTimestamp]);

    const firstPage = await caller.game.messages({
      roomId: "room-main",
      limit: 1,
    });

    expect(firstPage.items.map((post) => post.id)).toEqual(["post-2"]);
    expect(firstPage.nextCursor).toEqual({
      createdAt: sharedCreatedAt.toISOString(),
      id: "post-2",
    });

    const secondPage = await caller.game.messages({
      roomId: "room-main",
      limit: 1,
      cursor: firstPage.nextCursor,
    });

    expect(mockPostFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          roomId: "room-main",
          OR: [
            { createdAt: { lt: sharedCreatedAt } },
            {
              createdAt: sharedCreatedAt,
              id: { lt: "post-2" },
            },
          ],
        },
      }),
    );
    expect(secondPage.items.map((post) => post.id)).toEqual(["post-1"]);
  });
});

describe("game.results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("ENDED なのに winner が null の村は不整合エラーを返す", async () => {
    mockVillageFindUnique.mockResolvedValue({
      status: "ENDED",
      winner: null,
      name: "テスト村",
    });

    const caller = createPublicCaller();
    const err = await caller.game.results({ villageId: "village-1" }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "終了済みの村に勝敗情報がありません",
    });
    expect(mockPlayerFindMany).not.toHaveBeenCalled();
    expect(mockResultFindMany).not.toHaveBeenCalled();
  });
});

describe("game.state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUniqueUser.mockResolvedValue({
      id: "db-user-1",
      authId: "auth-user-1",
      username: "user1",
    });
    mockRecordFindUnique.mockResolvedValue(null);
  });

  test("占い結果は Result.divinedPlayerId のみから構築する（処刑で無効化された日は含めない）", async () => {
    mockVillageFindUnique.mockResolvedValue({
      id: "village-1",
      name: "テスト村",
      day: 3,
      status: "IN_PLAY",
      winner: null,
      nextUpdateTime: new Date(),
      showVoteTarget: true,
      discussionTime: 300,
      rooms: [{ id: "room-main", type: "MAIN" }],
      players: [
        {
          id: "seer-1",
          username: "seer",
          role: "FORTUNE_TELLER",
          status: "DEAD",
          userId: "db-user-1",
        },
        {
          id: "wolf-1",
          username: "wolf",
          role: "WEREWOLF",
          status: "ALIVE",
          userId: "other-user",
        },
      ],
    });

    // Day 2 は proceedDay で占い師が処刑され divinedPlayerId が null の想定 → 行自体がクエリに乗らない
    mockResultFindMany.mockResolvedValue([
      {
        day: 1,
        divinedPlayer: {
          id: "wolf-1",
          username: "wolf",
          role: "WEREWOLF",
        },
      },
    ]);

    const caller = await createAuthenticatedCaller();
    const state = await caller.game.state({ villageId: "village-1" });

    expect(mockResultFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          villageId: "village-1",
          day: { lt: 3 },
          divinedPlayerId: { not: null },
        }),
      }),
    );
    expect(state.divineResults).toEqual([
      {
        day: 1,
        targetId: "wolf-1",
        targetName: "wolf",
        isWerewolf: true,
      },
    ]);
  });
});

// ============================================================
// Shared village/player setup helpers for action & access control tests
// ============================================================

const IN_PLAY_VILLAGE = {
  status: "IN_PLAY" as const,
  day: 2,
  players: [
    { id: "player-1", username: "user1", role: "VILLAGER" as const, status: "ALIVE" as const, userId: "db-user-1" },
    { id: "player-2", username: "user2", role: "WEREWOLF" as const, status: "ALIVE" as const, userId: "other-user" },
    { id: "player-3", username: "user3", role: "FORTUNE_TELLER" as const, status: "ALIVE" as const, userId: "seer-user" },
    { id: "player-4", username: "user4", role: "BODYGUARD" as const, status: "ALIVE" as const, userId: "guard-user" },
    { id: "player-5", username: "user5", role: "VILLAGER" as const, status: "DEAD" as const, userId: "dead-user" },
  ],
};

function mockVillageForActions(overrides: Partial<typeof IN_PLAY_VILLAGE> = {}) {
  mockVillageFindUnique.mockResolvedValue({ ...IN_PLAY_VILLAGE, ...overrides });
}

// ============================================================
// Action mutations
// ============================================================

describe("game.vote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordUpdate.mockResolvedValue({ id: "record-1" });
  });

  test("生存プレイヤーが他の生存プレイヤーに投票できる", async () => {
    mockVillageForActions();
    const caller = await createAuthenticatedCaller();

    const result = await caller.game.vote({
      villageId: "village-1",
      targetPlayerId: "player-2",
    });

    expect(result).toEqual({ success: true });
    expect(mockRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          playerId_villageId_day: {
            playerId: "player-1",
            villageId: "village-1",
            day: 2,
          },
        },
        data: { voteTargetId: "player-2" },
      }),
    );
  });

  test("自分自身には投票できない", async () => {
    mockVillageForActions();
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .vote({ villageId: "village-1", targetPlayerId: "player-1" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "BAD_REQUEST", message: "自分自身を対象にできません" });
    expect(mockRecordUpdate).not.toHaveBeenCalled();
  });

  test("死亡プレイヤーには投票できない", async () => {
    mockVillageForActions();
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .vote({ villageId: "village-1", targetPlayerId: "player-5" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "BAD_REQUEST", message: "無効な対象です" });
  });

  test("死亡者は投票できない", async () => {
    mockVillageForActions({
      players: IN_PLAY_VILLAGE.players.map((p) =>
        p.userId === "db-user-1" ? { ...p, status: "DEAD" as const } : p,
      ),
    });
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .vote({ villageId: "village-1", targetPlayerId: "player-2" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "死亡者はアクションを実行できません" });
  });

  test("ゲームが進行中でないと投票できない", async () => {
    mockVillageForActions({ status: "ENDED" as never });
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .vote({ villageId: "village-1", targetPlayerId: "player-2" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "BAD_REQUEST", message: "ゲームが進行中ではありません" });
  });
});

describe("game.attack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordUpdate.mockResolvedValue({ id: "record-1" });
  });

  test("人狼が非人狼の生存プレイヤーを襲撃できる", async () => {
    // player-2 (WEREWOLF, userId: other-user) がアクション実行者
    mockFindUniqueUser.mockResolvedValue({ id: "other-user", authId: "auth-user-1", username: "user2" });
    mockVillageForActions({
      players: IN_PLAY_VILLAGE.players.map((p) =>
        p.userId === "other-user" ? { ...p, userId: "db-user-1" } :
        p.userId === "db-user-1" ? { ...p, userId: "other-user" } : p,
      ),
    });
    const caller = await createAuthenticatedCaller();

    const result = await caller.game.attack({
      villageId: "village-1",
      targetPlayerId: "player-3",
    });

    expect(result).toEqual({ success: true });
    expect(mockRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { attackTargetId: "player-3" },
      }),
    );
  });

  test("村人は襲撃できない", async () => {
    mockVillageForActions();
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .attack({ villageId: "village-1", targetPlayerId: "player-2" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "人狼のみが襲撃できます" });
  });

  test("人狼は別の人狼を襲撃できない", async () => {
    // 人狼が2人いるシナリオ
    const players = [
      { id: "wolf-1", username: "wolf1", role: "WEREWOLF" as const, status: "ALIVE" as const, userId: "db-user-1" },
      { id: "wolf-2", username: "wolf2", role: "WEREWOLF" as const, status: "ALIVE" as const, userId: "other-wolf" },
      { id: "villager-1", username: "v1", role: "VILLAGER" as const, status: "ALIVE" as const, userId: "v-user" },
    ];
    mockVillageForActions({ players });
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .attack({ villageId: "village-1", targetPlayerId: "wolf-2" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "BAD_REQUEST", message: "無効な襲撃対象です" });
  });
});

describe("game.divine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordUpdate.mockResolvedValue({ id: "record-1" });
  });

  test("占い師が他プレイヤーを占える", async () => {
    // player-3 (FORTUNE_TELLER) をログインユーザーにする
    mockVillageForActions({
      players: IN_PLAY_VILLAGE.players.map((p) =>
        p.userId === "seer-user" ? { ...p, userId: "db-user-1" } :
        p.userId === "db-user-1" ? { ...p, userId: "seer-user" } : p,
      ),
    });
    const caller = await createAuthenticatedCaller();

    const result = await caller.game.divine({
      villageId: "village-1",
      targetPlayerId: "player-2",
    });

    expect(result).toEqual({ success: true });
    expect(mockRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { divineTargetId: "player-2" },
      }),
    );
  });

  test("占い師以外は占えない", async () => {
    mockVillageForActions();
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .divine({ villageId: "village-1", targetPlayerId: "player-2" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "占い師のみが占えます" });
  });
});

describe("game.guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordUpdate.mockResolvedValue({ id: "record-1" });
  });

  test("騎士が他プレイヤーを守護できる", async () => {
    // player-4 (BODYGUARD) をログインユーザーにする
    mockVillageForActions({
      players: IN_PLAY_VILLAGE.players.map((p) =>
        p.userId === "guard-user" ? { ...p, userId: "db-user-1" } :
        p.userId === "db-user-1" ? { ...p, userId: "guard-user" } : p,
      ),
    });
    const caller = await createAuthenticatedCaller();

    const result = await caller.game.guard({
      villageId: "village-1",
      targetPlayerId: "player-2",
    });

    expect(result).toEqual({ success: true });
    expect(mockRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { guardTargetId: "player-2" },
      }),
    );
  });

  test("騎士以外は守護できない", async () => {
    mockVillageForActions();
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .guard({ villageId: "village-1", targetPlayerId: "player-2" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "騎士のみが守護できます" });
  });
});

// ============================================================
// Room access control — messages (read)
// ============================================================

describe("game.messages access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostFindMany.mockResolvedValue([]);
  });

  // --- MAIN ルーム ---

  test("非参加者でも MAIN ルームのメッセージを読める", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-main",
      type: "MAIN",
      villageId: "village-1",
      village: { status: "IN_PLAY" },
    });
    const caller = createPublicCaller();

    const result = await caller.game.messages({ roomId: "room-main", limit: 20 });

    expect(result.items).toEqual([]);
    expect(mockPostFindMany).toHaveBeenCalled();
  });

  test("未ログインユーザーはゲーム中の MAIN ルームのメッセージを読める", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-main",
      type: "MAIN",
      villageId: "village-1",
      village: { status: "IN_PLAY" },
    });
    const caller = createPublicCaller();

    const result = await caller.game.messages({ roomId: "room-main", limit: 20 });

    expect(result.items).toEqual([]);
    expect(mockPostFindMany).toHaveBeenCalled();
  });

  // --- WOLF ルーム (ゲーム中) ---

  test("村人はゲーム中の WOLF ルームのメッセージを読めない", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-wolf",
      type: "WOLF",
      villageId: "village-1",
      village: { status: "IN_PLAY" },
    });
    mockFindUniqueUser.mockResolvedValue({ id: "db-user-1" });
    mockPlayerFindUnique.mockResolvedValue({
      id: "player-1",
      role: "VILLAGER",
      status: "ALIVE",
    });
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .messages({ roomId: "room-wolf", limit: 20 })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "人狼ルームにアクセスできません" });
    expect(mockPostFindMany).not.toHaveBeenCalled();
  });

  test("人狼はゲーム中の WOLF ルームのメッセージを読める", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-wolf",
      type: "WOLF",
      villageId: "village-1",
      village: { status: "IN_PLAY" },
    });
    mockFindUniqueUser.mockResolvedValue({ id: "db-user-1" });
    mockPlayerFindUnique.mockResolvedValue({
      id: "player-2",
      role: "WEREWOLF",
      status: "ALIVE",
    });
    const caller = await createAuthenticatedCaller();

    const result = await caller.game.messages({ roomId: "room-wolf", limit: 20 });

    expect(result.items).toEqual([]);
    expect(mockPostFindMany).toHaveBeenCalled();
  });

  test("未ログインユーザーはゲーム中の WOLF ルームを読めない", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-wolf",
      type: "WOLF",
      villageId: "village-1",
      village: { status: "IN_PLAY" },
    });
    const caller = createPublicCaller();

    const err = await caller.game
      .messages({ roomId: "room-wolf", limit: 20 })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "ログインが必要です" });
  });

  test("非参加者はゲーム中の WOLF ルームを読めない", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-wolf",
      type: "WOLF",
      villageId: "village-1",
      village: { status: "IN_PLAY" },
    });
    mockFindUniqueUser.mockResolvedValue({ id: "db-user-1" });
    mockPlayerFindUnique.mockResolvedValue(null);
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .messages({ roomId: "room-wolf", limit: 20 })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "人狼ルームにアクセスできません" });
  });

  // --- DEAD ルーム (ゲーム中) ---

  test("生存者はゲーム中の DEAD ルームのメッセージを読めない", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-dead",
      type: "DEAD",
      villageId: "village-1",
      village: { status: "IN_PLAY" },
    });
    mockFindUniqueUser.mockResolvedValue({ id: "db-user-1" });
    mockPlayerFindUnique.mockResolvedValue({
      id: "player-1",
      role: "VILLAGER",
      status: "ALIVE",
    });
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .messages({ roomId: "room-dead", limit: 20 })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "霊界ルームにアクセスできません" });
  });

  test("死亡者はゲーム中の DEAD ルームのメッセージを読める", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-dead",
      type: "DEAD",
      villageId: "village-1",
      village: { status: "IN_PLAY" },
    });
    mockFindUniqueUser.mockResolvedValue({ id: "db-user-1" });
    mockPlayerFindUnique.mockResolvedValue({
      id: "player-5",
      role: "VILLAGER",
      status: "DEAD",
    });
    const caller = await createAuthenticatedCaller();

    const result = await caller.game.messages({ roomId: "room-dead", limit: 20 });

    expect(result.items).toEqual([]);
  });

  test("未ログインユーザーはゲーム中の DEAD ルームを読めない", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-dead",
      type: "DEAD",
      villageId: "village-1",
      village: { status: "IN_PLAY" },
    });
    const caller = createPublicCaller();

    const err = await caller.game
      .messages({ roomId: "room-dead", limit: 20 })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "ログインが必要です" });
  });

  test("非参加者はゲーム中の DEAD ルームを読めない", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-dead",
      type: "DEAD",
      villageId: "village-1",
      village: { status: "IN_PLAY" },
    });
    mockFindUniqueUser.mockResolvedValue({ id: "db-user-1" });
    mockPlayerFindUnique.mockResolvedValue(null);
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .messages({ roomId: "room-dead", limit: 20 })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "霊界ルームにアクセスできません" });
  });

  // --- ゲーム終了後 ---

  test("ゲーム終了後は誰でも WOLF ルームのメッセージを読める", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-wolf",
      type: "WOLF",
      villageId: "village-1",
      village: { status: "ENDED" },
    });
    const caller = createPublicCaller();

    const result = await caller.game.messages({ roomId: "room-wolf", limit: 20 });

    expect(result.items).toEqual([]);
    expect(mockPostFindMany).toHaveBeenCalled();
  });

  test("ゲーム終了後は誰でも DEAD ルームのメッセージを読める", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-dead",
      type: "DEAD",
      villageId: "village-1",
      village: { status: "ENDED" },
    });
    const caller = createPublicCaller();

    const result = await caller.game.messages({ roomId: "room-dead", limit: 20 });

    expect(result.items).toEqual([]);
    expect(mockPostFindMany).toHaveBeenCalled();
  });
});

// ============================================================
// Room access control — sendMessage (write)
// ============================================================

describe("game.sendMessage access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostCreate.mockResolvedValue({ id: "post-new" });
  });

  function mockSendMessageContext(
    roomType: "MAIN" | "WOLF" | "DEAD",
    playerRole: string,
    playerStatus: "ALIVE" | "DEAD",
  ) {
    mockRoomFindUnique.mockResolvedValue({
      id: `room-${roomType.toLowerCase()}`,
      type: roomType,
      villageId: "village-1",
    });
    mockVillageFindUnique.mockResolvedValue({
      status: "IN_PLAY",
      day: 2,
    });
    mockPlayerFindUnique.mockResolvedValue({
      id: "player-1",
      role: playerRole,
      status: playerStatus,
    });
  }

  test("生存者は MAIN ルームに投稿できる", async () => {
    mockSendMessageContext("MAIN", "VILLAGER", "ALIVE");
    const caller = await createAuthenticatedCaller();

    const result = await caller.game.sendMessage({
      roomId: "room-main",
      content: "こんにちは",
    });

    expect(result).toEqual({ id: "post-new" });
    expect(mockPostCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "こんにちは",
          owner: "PLAYER",
          roomId: "room-main",
        }),
      }),
    );
  });

  test("死亡者は MAIN ルームに投稿できない", async () => {
    mockSendMessageContext("MAIN", "VILLAGER", "DEAD");
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .sendMessage({ roomId: "room-main", content: "test" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "生存者のみがメインルームに投稿できます" });
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  test("生存中の人狼は WOLF ルームに投稿できる", async () => {
    mockSendMessageContext("WOLF", "WEREWOLF", "ALIVE");
    const caller = await createAuthenticatedCaller();

    const result = await caller.game.sendMessage({
      roomId: "room-wolf",
      content: "誰を襲う？",
    });

    expect(result).toEqual({ id: "post-new" });
  });

  test("村人は WOLF ルームに投稿できない", async () => {
    mockSendMessageContext("WOLF", "VILLAGER", "ALIVE");
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .sendMessage({ roomId: "room-wolf", content: "test" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "生存中の人狼のみが人狼ルームに投稿できます" });
  });

  test("死亡した人狼は WOLF ルームに投稿できない", async () => {
    mockSendMessageContext("WOLF", "WEREWOLF", "DEAD");
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .sendMessage({ roomId: "room-wolf", content: "test" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "生存中の人狼のみが人狼ルームに投稿できます" });
  });

  test("死亡者は DEAD ルームに投稿できる", async () => {
    mockSendMessageContext("DEAD", "VILLAGER", "DEAD");
    const caller = await createAuthenticatedCaller();

    const result = await caller.game.sendMessage({
      roomId: "room-dead",
      content: "あの世から",
    });

    expect(result).toEqual({ id: "post-new" });
  });

  test("生存者は DEAD ルームに投稿できない", async () => {
    mockSendMessageContext("DEAD", "VILLAGER", "ALIVE");
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .sendMessage({ roomId: "room-dead", content: "test" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN", message: "死亡者のみが霊界ルームに投稿できます" });
  });

  test("ゲーム中でないと投稿できない", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: "room-main",
      type: "MAIN",
      villageId: "village-1",
    });
    mockVillageFindUnique.mockResolvedValue({
      status: "ENDED",
      day: 5,
    });
    const caller = await createAuthenticatedCaller();

    const err = await caller.game
      .sendMessage({ roomId: "room-main", content: "test" })
      .catch((e) => e);

    expect(err).toMatchObject({ code: "BAD_REQUEST", message: "ゲーム中のみメッセージを送信できます" });
  });
});
