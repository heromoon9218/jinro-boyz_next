import { beforeEach, describe, expect, test, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// CUID fixtures (Prisma uses cuid() for IDs)
const VILLAGE_1 = "clvvillage000000001";
const PLAYER_1 = "clvplayer0000000011";
const PLAYER_2 = "clvplayer0000000012";
const PLAYER_3 = "clvplayer0000000013";
const DB_USER_1 = "clvdbuser0000000021";
const DB_USER_2 = "clvdbuser0000000022";
const DB_USER_3 = "clvdbuser0000000023";
const AUTH_USER_1 = "clauthuser000000031";
const AUTH_USER_2 = "clauthuser000000032";
const AUTH_USER_3 = "clauthuser000000033";
const ROOM_MAIN = "clvroomma0000000041";
const ROOM_WOLF = "clvroomwl0000000042";
const ROOM_DEAD = "clvroomdd0000000043";
const RECORD_1 = "clvrecord0000000051";
const PLAYER_FT = "clvplayerft00000061";
const PLAYER_BG = "clvplayerbg00000062";
const NONEXISTENT = "clvnonexistent00000";

const {
  mockFindUniqueUser,
  mockVillageFindUnique,
  mockPlayerFindFirst,
  mockRecordFindUnique,
  mockRecordUpdate,
  mockRecordFindMany,
  mockResultFindMany,
  mockRoomFindUnique,
  mockPostFindMany,
  mockPostCreate,
} = vi.hoisted(() => ({
  mockFindUniqueUser: vi.fn(),
  mockVillageFindUnique: vi.fn(),
  mockPlayerFindFirst: vi.fn(),
  mockRecordFindUnique: vi.fn(),
  mockRecordUpdate: vi.fn(),
  mockRecordFindMany: vi.fn(),
  mockResultFindMany: vi.fn(),
  mockRoomFindUnique: vi.fn(),
  mockPostFindMany: vi.fn(),
  mockPostCreate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: AUTH_USER_1 } },
        }),
      },
    }),
  ),
}));

vi.mock("@/server/db", () => ({
  db: {
    user: { findUnique: mockFindUniqueUser },
    village: { findUnique: mockVillageFindUnique },
    player: { findFirst: mockPlayerFindFirst },
    record: { findUnique: mockRecordFindUnique, update: mockRecordUpdate, findMany: mockRecordFindMany },
    result: { findMany: mockResultFindMany },
    room: { findUnique: mockRoomFindUnique },
    post: { findMany: mockPostFindMany, create: mockPostCreate },
  },
}));

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "../_app";

const createCaller = createCallerFactory(appRouter);

// 認証済みユーザー用 caller を作成するヘルパー
function createAuthCaller(authId = AUTH_USER_1) {
  mockFindUniqueUser.mockResolvedValue({
    id: DB_USER_1,
    authId,
    username: "player1",
  });
  return createCaller({
    db: {
      user: { findUnique: mockFindUniqueUser },
      village: { findUnique: mockVillageFindUnique },
      player: { findFirst: mockPlayerFindFirst },
      record: { findUnique: mockRecordFindUnique, update: mockRecordUpdate, findMany: mockRecordFindMany },
      result: { findMany: mockResultFindMany },
      room: { findUnique: mockRoomFindUnique },
      post: { findMany: mockPostFindMany, create: mockPostCreate },
    } as never,
    supabase: {} as never,
    user: { id: authId },
    headers: new Headers(),
  });
}

// 公開ユーザー（未認証）用 caller を作成するヘルパー
function createPublicCaller() {
  return createCaller({
    db: {
      user: { findUnique: mockFindUniqueUser },
      village: { findUnique: mockVillageFindUnique },
      player: { findFirst: mockPlayerFindFirst },
      record: { findUnique: mockRecordFindUnique, update: mockRecordUpdate, findMany: mockRecordFindMany },
      result: { findMany: mockResultFindMany },
      room: { findUnique: mockRoomFindUnique },
      post: { findMany: mockPostFindMany, create: mockPostCreate },
    } as never,
    supabase: {} as never,
    user: null,
    headers: new Headers(),
  });
}

// ── テスト用フィクスチャ ──

const baseVillage = {
  id: VILLAGE_1,
  name: "テスト村",
  day: 1,
  status: "IN_PLAY" as const,
  winner: null,
  discussionTime: 300,
  showVoteTarget: true,
  nextUpdateTime: null,
  players: [
    {
      id: PLAYER_1,
      username: "player1",
      status: "ALIVE" as const,
      role: "WEREWOLF" as const,
      createdAt: new Date(),
      user: { id: DB_USER_1, authId: AUTH_USER_1 },
    },
    {
      id: PLAYER_2,
      username: "player2",
      status: "ALIVE" as const,
      role: "VILLAGER" as const,
      createdAt: new Date(),
      user: { id: DB_USER_2, authId: AUTH_USER_2 },
    },
    {
      id: PLAYER_3,
      username: "player3",
      status: "ALIVE" as const,
      role: "WEREWOLF" as const,
      createdAt: new Date(),
      user: { id: DB_USER_3, authId: AUTH_USER_3 },
    },
  ],
  rooms: [
    { id: ROOM_MAIN, type: "MAIN" as const },
    { id: ROOM_WOLF, type: "WOLF" as const },
    { id: ROOM_DEAD, type: "DEAD" as const },
  ],
};

const baseRecord = {
  id: RECORD_1,
  playerId: PLAYER_1,
  villageId: VILLAGE_1,
  day: 1,
  voteTargetId: null,
  attackTargetId: null,
  divineTargetId: null,
  guardTargetId: null,
};

// ──────────────────────────────────────────────
// game.state
// ──────────────────────────────────────────────

describe("game.state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("公開ユーザーでも state を取得できる", async () => {
    mockVillageFindUnique.mockResolvedValue(baseVillage);

    const caller = createPublicCaller();
    const result = await caller.game.state({ villageId: VILLAGE_1 });

    expect(result.village.id).toBe(VILLAGE_1);
    expect(result.village.status).toBe("IN_PLAY");
  });

  test("IN_PLAY 中は他プレイヤーの役職が非公開になる", async () => {
    mockVillageFindUnique.mockResolvedValue(baseVillage);

    // auth-user-2（VILLAGER）として閲覧 → player-1, player-3(WEREWOLF) の role は見えない
    const caller = createCaller({
      db: {
        user: { findUnique: mockFindUniqueUser },
        village: { findUnique: mockVillageFindUnique },
        player: { findFirst: mockPlayerFindFirst },
        record: { findUnique: mockRecordFindUnique, update: mockRecordUpdate, findMany: mockRecordFindMany },
        result: { findMany: mockResultFindMany },
        room: { findUnique: mockRoomFindUnique },
        post: { findMany: mockPostFindMany, create: mockPostCreate },
      } as never,
      supabase: {} as never,
      user: { id: AUTH_USER_2 },
      headers: new Headers(),
    });
    mockFindUniqueUser.mockResolvedValue({ id: DB_USER_2, authId: AUTH_USER_2, username: "player2" });
    mockRecordFindUnique.mockResolvedValue(null);

    const result = await caller.game.state({ villageId: VILLAGE_1 });

    // 自分自身（player-2）は role 付き
    const self = result.players.find((p) => p.id === PLAYER_2);
    expect(self).toHaveProperty("role", "VILLAGER");

    // 他プレイヤーは role なし
    const other1 = result.players.find((p) => p.id === PLAYER_1);
    expect(other1).not.toHaveProperty("role");
    const other3 = result.players.find((p) => p.id === PLAYER_3);
    expect(other3).not.toHaveProperty("role");
  });

  test("IN_PLAY 中に人狼同士は互いの role が公開される", async () => {
    mockVillageFindUnique.mockResolvedValue(baseVillage);
    mockFindUniqueUser.mockResolvedValue({ id: DB_USER_1, authId: AUTH_USER_1, username: "player1" });
    mockRecordFindUnique.mockResolvedValue(baseRecord);

    // auth-user-1（WEREWOLF）として閲覧
    const caller = createAuthCaller(AUTH_USER_1);
    const result = await caller.game.state({ villageId: VILLAGE_1 });

    // 自分（player-1）は role 付き
    const self = result.players.find((p) => p.id === PLAYER_1);
    expect(self).toHaveProperty("role", "WEREWOLF");

    // 同じ人狼（player-3）も role が見える
    const fellowWolf = result.players.find((p) => p.id === PLAYER_3);
    expect(fellowWolf).toHaveProperty("role", "WEREWOLF");

    // 村人（player-2）の role は見えない
    const villager = result.players.find((p) => p.id === PLAYER_2);
    expect(villager).not.toHaveProperty("role");
  });

  test("ENDED 後は全プレイヤーの role が公開される", async () => {
    mockVillageFindUnique.mockResolvedValue({ ...baseVillage, status: "ENDED", winner: "HUMANS" });

    const caller = createPublicCaller();
    const result = await caller.game.state({ villageId: VILLAGE_1 });

    for (const player of result.players) {
      expect(player).toHaveProperty("role");
    }
  });

  test("存在しない村は NOT_FOUND を返す", async () => {
    mockVillageFindUnique.mockResolvedValue(null);

    const caller = createPublicCaller();
    const err = await caller.game.state({ villageId: NONEXISTENT }).catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
  });
});

// ──────────────────────────────────────────────
// game.vote
// ──────────────────────────────────────────────

describe("game.vote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("正常に投票できる", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst
      .mockResolvedValueOnce({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "WEREWOLF" }) // resolveRecord: player
      .mockResolvedValueOnce({ id: PLAYER_2, username: "player2", status: "ALIVE", role: "VILLAGER" }); // assertTargetAlive
    mockRecordFindUnique.mockResolvedValue(baseRecord);
    mockRecordUpdate.mockResolvedValue({ ...baseRecord, voteTargetId: PLAYER_2 });

    const caller = createAuthCaller();
    const result = await caller.game.vote({ villageId: VILLAGE_1, targetPlayerId: PLAYER_2 });

    expect(mockRecordUpdate).toHaveBeenCalledWith({
      where: { id: RECORD_1 },
      data: { voteTargetId: PLAYER_2 },
    });
    expect(result.voteTargetId).toBe(PLAYER_2);
  });

  test("自分自身への投票は BAD_REQUEST を返す", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst.mockResolvedValueOnce({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "VILLAGER" });
    mockRecordFindUnique.mockResolvedValue(baseRecord); // record.playerId === PLAYER_1

    const caller = createAuthCaller();
    const err = await caller.game
      .vote({ villageId: VILLAGE_1, targetPlayerId: PLAYER_1 })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect((err as TRPCError).message).toBe("自分自身には投票できません");
  });

  test("死亡者は投票できない（FORBIDDEN）", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst.mockResolvedValueOnce({ id: PLAYER_1, username: "player1", status: "DEAD", role: "VILLAGER" });

    const caller = createAuthCaller();
    const err = await caller.game
      .vote({ villageId: VILLAGE_1, targetPlayerId: PLAYER_2 })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toBe("生存者のみ実行できます");
  });

  test("非参加者は投票できない（FORBIDDEN）", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst.mockResolvedValueOnce(null); // 参加者なし

    const caller = createAuthCaller();
    const err = await caller.game
      .vote({ villageId: VILLAGE_1, targetPlayerId: PLAYER_2 })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toBe("参加者のみ実行できます");
  });
});

// ──────────────────────────────────────────────
// game.attack
// ──────────────────────────────────────────────

describe("game.attack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("人狼が正常に襲撃対象を設定できる", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst
      .mockResolvedValueOnce({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "WEREWOLF" }) // resolveRecord
      .mockResolvedValueOnce({ id: PLAYER_2, username: "player2", status: "ALIVE", role: "VILLAGER" }); // assertTargetAlive
    mockRecordFindUnique.mockResolvedValue(baseRecord);
    mockRoomFindUnique.mockResolvedValue({ id: ROOM_WOLF, type: "WOLF" });
    mockPostCreate.mockResolvedValue({ id: "post-system-1" });
    mockRecordUpdate.mockResolvedValue({ ...baseRecord, attackTargetId: PLAYER_2 });

    const caller = createAuthCaller();
    const result = await caller.game.attack({ villageId: VILLAGE_1, targetPlayerId: PLAYER_2 });

    expect(mockRecordUpdate).toHaveBeenCalledWith({
      where: { id: RECORD_1 },
      data: { attackTargetId: PLAYER_2 },
    });
    expect(result.attackTargetId).toBe(PLAYER_2);
  });

  test("非人狼は attack を実行できない（FORBIDDEN）", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst.mockResolvedValueOnce({ id: PLAYER_2, username: "player2", status: "ALIVE", role: "VILLAGER" });

    const caller = createAuthCaller();
    const err = await caller.game
      .attack({ villageId: VILLAGE_1, targetPlayerId: PLAYER_3 })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  test("人狼への襲撃は BAD_REQUEST を返す", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst
      .mockResolvedValueOnce({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "WEREWOLF" }) // resolveRecord
      .mockResolvedValueOnce({ id: PLAYER_3, username: "player3", status: "ALIVE", role: "WEREWOLF" }); // assertTargetAlive
    mockRecordFindUnique.mockResolvedValue(baseRecord);

    const caller = createAuthCaller();
    const err = await caller.game
      .attack({ villageId: VILLAGE_1, targetPlayerId: PLAYER_3 })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect((err as TRPCError).message).toBe("人狼は襲撃できません");
  });
});

// ──────────────────────────────────────────────
// game.divine
// ──────────────────────────────────────────────

describe("game.divine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fortuneTellerRecord = { ...baseRecord, playerId: PLAYER_FT };

  test("占い師が正常に占える", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst
      .mockResolvedValueOnce({ id: PLAYER_FT, username: "fortuneteller", status: "ALIVE", role: "FORTUNE_TELLER" })
      .mockResolvedValueOnce({ id: PLAYER_2, username: "player2", status: "ALIVE", role: "VILLAGER" });
    mockRecordFindUnique.mockResolvedValue(fortuneTellerRecord);
    mockRecordUpdate.mockResolvedValue({ ...fortuneTellerRecord, divineTargetId: PLAYER_2 });

    const caller = createAuthCaller();
    const result = await caller.game.divine({ villageId: VILLAGE_1, targetPlayerId: PLAYER_2 });

    expect(mockRecordUpdate).toHaveBeenCalledWith({
      where: { id: RECORD_1 },
      data: { divineTargetId: PLAYER_2 },
    });
    expect(result.divineTargetId).toBe(PLAYER_2);
  });

  test("非占い師は divine を実行できない（FORBIDDEN）", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst.mockResolvedValueOnce({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "VILLAGER" });
    mockRecordFindUnique.mockResolvedValue(baseRecord);

    const caller = createAuthCaller();
    const err = await caller.game
      .divine({ villageId: VILLAGE_1, targetPlayerId: PLAYER_2 })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  test("自分自身は占えない（BAD_REQUEST）", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst.mockResolvedValueOnce({ id: PLAYER_FT, username: "fortuneteller", status: "ALIVE", role: "FORTUNE_TELLER" });
    mockRecordFindUnique.mockResolvedValue(fortuneTellerRecord); // playerId: PLAYER_FT

    const caller = createAuthCaller();
    const err = await caller.game
      .divine({ villageId: VILLAGE_1, targetPlayerId: PLAYER_FT })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect((err as TRPCError).message).toBe("自分自身は占えません");
  });
});

// ──────────────────────────────────────────────
// game.guard
// ──────────────────────────────────────────────

describe("game.guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const bodyguardRecord = { ...baseRecord, playerId: PLAYER_BG };

  test("騎士が正常に護衛できる", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst
      .mockResolvedValueOnce({ id: PLAYER_BG, username: "bodyguard", status: "ALIVE", role: "BODYGUARD" })
      .mockResolvedValueOnce({ id: PLAYER_2, username: "player2", status: "ALIVE", role: "VILLAGER" });
    mockRecordFindUnique.mockResolvedValue(bodyguardRecord);
    mockRecordUpdate.mockResolvedValue({ ...bodyguardRecord, guardTargetId: PLAYER_2 });

    const caller = createAuthCaller();
    const result = await caller.game.guard({ villageId: VILLAGE_1, targetPlayerId: PLAYER_2 });

    expect(mockRecordUpdate).toHaveBeenCalledWith({
      where: { id: RECORD_1 },
      data: { guardTargetId: PLAYER_2 },
    });
    expect(result.guardTargetId).toBe(PLAYER_2);
  });

  test("非騎士は guard を実行できない（FORBIDDEN）", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst.mockResolvedValueOnce({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "VILLAGER" });
    mockRecordFindUnique.mockResolvedValue(baseRecord);

    const caller = createAuthCaller();
    const err = await caller.game
      .guard({ villageId: VILLAGE_1, targetPlayerId: PLAYER_2 })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  test("自分自身は護衛できない（BAD_REQUEST）", async () => {
    mockVillageFindUnique.mockResolvedValue({ id: VILLAGE_1, day: 1, status: "IN_PLAY" });
    mockPlayerFindFirst.mockResolvedValueOnce({ id: PLAYER_BG, username: "bodyguard", status: "ALIVE", role: "BODYGUARD" });
    mockRecordFindUnique.mockResolvedValue(bodyguardRecord); // playerId: PLAYER_BG

    const caller = createAuthCaller();
    const err = await caller.game
      .guard({ villageId: VILLAGE_1, targetPlayerId: PLAYER_BG })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect((err as TRPCError).message).toBe("自分自身は護衛できません");
  });
});

// ──────────────────────────────────────────────
// game.divineResults
// ──────────────────────────────────────────────

describe("game.divineResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("占い師のみ占い結果を取得できる", async () => {
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_FT, username: "fortuneteller", status: "ALIVE", role: "FORTUNE_TELLER" });
    mockResultFindMany.mockResolvedValue([
      {
        day: 1,
        villageId: VILLAGE_1,
        divinedPlayerId: PLAYER_2,
        divinedPlayer: { username: "player2", role: "VILLAGER" },
      },
    ]);

    const caller = createAuthCaller();
    const results = await caller.game.divineResults({ villageId: VILLAGE_1 });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ day: 1, targetUsername: "player2", isWerewolf: false });
  });

  test("非占い師は divineResults を取得できない（FORBIDDEN）", async () => {
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "VILLAGER" });

    const caller = createAuthCaller();
    const err = await caller.game.divineResults({ villageId: VILLAGE_1 }).catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toBe("占い師のみが閲覧できます");
  });
});

// ──────────────────────────────────────────────
// game.psychicResults
// ──────────────────────────────────────────────

describe("game.psychicResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("霊媒師のみ霊媒結果を取得できる", async () => {
    mockPlayerFindFirst.mockResolvedValue({ id: "player-ps", username: "psychic", status: "ALIVE", role: "PSYCHIC" });
    mockResultFindMany.mockResolvedValue([
      {
        day: 1,
        villageId: VILLAGE_1,
        votedPlayerId: PLAYER_2,
        votedPlayer: { username: "player2", role: "WEREWOLF" },
      },
    ]);

    const caller = createAuthCaller();
    const results = await caller.game.psychicResults({ villageId: VILLAGE_1 });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ day: 1, targetUsername: "player2", isWerewolf: true });
  });

  test("非霊媒師は psychicResults を取得できない（FORBIDDEN）", async () => {
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "VILLAGER" });

    const caller = createAuthCaller();
    const err = await caller.game.psychicResults({ villageId: VILLAGE_1 }).catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toBe("霊媒師のみが閲覧できます");
  });
});

// ──────────────────────────────────────────────
// game.posts
// ──────────────────────────────────────────────

describe("game.posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const basePosts = [
    {
      id: "post-1",
      content: "こんにちは",
      day: 1,
      owner: "PLAYER" as const,
      createdAt: new Date(),
      player: { id: PLAYER_1, username: "player1" },
    },
  ];

  test("公開ユーザーでも MAIN ルームの投稿を取得できる", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: ROOM_MAIN,
      type: "MAIN",
      village: { id: VILLAGE_1, status: "IN_PLAY" },
    });
    mockPostFindMany.mockResolvedValue(basePosts);

    const caller = createPublicCaller();
    const result = await caller.game.posts({ roomId: ROOM_MAIN });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("こんにちは");
  });

  test("ゲーム中の WOLF ルームは人狼のみアクセス可能", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: ROOM_WOLF,
      type: "WOLF",
      village: { id: VILLAGE_1, status: "IN_PLAY" },
    });
    // 非人狼プレイヤー
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_2, username: "player2", status: "ALIVE", role: "VILLAGER" });

    const caller = createAuthCaller(AUTH_USER_2);
    mockFindUniqueUser.mockResolvedValue({ id: DB_USER_2, authId: AUTH_USER_2, username: "player2" });

    const err = await caller.game.posts({ roomId: ROOM_WOLF }).catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  test("ゲーム中の WOLF ルームは人狼がアクセスできる", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: ROOM_WOLF,
      type: "WOLF",
      village: { id: VILLAGE_1, status: "IN_PLAY" },
    });
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "WEREWOLF" });
    mockPostFindMany.mockResolvedValue(basePosts);

    const caller = createAuthCaller(AUTH_USER_1);
    const result = await caller.game.posts({ roomId: ROOM_WOLF });

    expect(result).toHaveLength(1);
  });

  test("ゲーム中の DEAD ルームは死亡者のみアクセス可能", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: ROOM_DEAD,
      type: "DEAD",
      village: { id: VILLAGE_1, status: "IN_PLAY" },
    });
    // 生存者
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "VILLAGER" });

    const caller = createAuthCaller(AUTH_USER_1);
    const err = await caller.game.posts({ roomId: ROOM_DEAD }).catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  test("ゲーム中の DEAD ルームは死亡者がアクセスできる", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: ROOM_DEAD,
      type: "DEAD",
      village: { id: VILLAGE_1, status: "IN_PLAY" },
    });
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_2, username: "player2", status: "DEAD", role: "VILLAGER" });
    mockPostFindMany.mockResolvedValue(basePosts);

    const caller = createAuthCaller(AUTH_USER_2);
    const result = await caller.game.posts({ roomId: ROOM_DEAD });

    expect(result).toHaveLength(1);
  });

  test("ENDED 後は全ルームが閲覧可能（公開ユーザーも WOLF ルームにアクセスできる）", async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: ROOM_WOLF,
      type: "WOLF",
      village: { id: VILLAGE_1, status: "ENDED" },
    });
    mockPostFindMany.mockResolvedValue(basePosts);

    const caller = createPublicCaller();
    const result = await caller.game.posts({ roomId: ROOM_WOLF });

    expect(result).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────
// game.sendMessage
// ──────────────────────────────────────────────

describe("game.sendMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mainRoom = {
    id: ROOM_MAIN,
    type: "MAIN" as const,
    village: { id: VILLAGE_1, day: 1, status: "IN_PLAY" as const },
  };

  const wolfRoom = {
    id: ROOM_WOLF,
    type: "WOLF" as const,
    village: { id: VILLAGE_1, day: 1, status: "IN_PLAY" as const },
  };

  const deadRoom = {
    id: ROOM_DEAD,
    type: "DEAD" as const,
    village: { id: VILLAGE_1, day: 1, status: "IN_PLAY" as const },
  };

  test("生存者が MAIN ルームに発言できる", async () => {
    mockRoomFindUnique.mockResolvedValue(mainRoom);
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "VILLAGER" });
    mockPostCreate.mockResolvedValue({
      id: "post-new",
      content: "テスト発言",
      day: 1,
      owner: "PLAYER",
      playerId: PLAYER_1,
      roomId: ROOM_MAIN,
      createdAt: new Date(),
    });

    const caller = createAuthCaller();
    const result = await caller.game.sendMessage({ roomId: ROOM_MAIN, content: "テスト発言" });

    expect(mockPostCreate).toHaveBeenCalledWith({
      data: {
        content: "テスト発言",
        day: 1,
        owner: "PLAYER",
        playerId: PLAYER_1,
        roomId: ROOM_MAIN,
      },
    });
    expect(result.content).toBe("テスト発言");
  });

  test("死亡者は MAIN ルームに発言できない（FORBIDDEN）", async () => {
    mockRoomFindUnique.mockResolvedValue(mainRoom);
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_2, username: "player2", status: "DEAD", role: "VILLAGER" });

    const caller = createAuthCaller(AUTH_USER_2);
    const err = await caller.game
      .sendMessage({ roomId: ROOM_MAIN, content: "発言テスト" })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toBe("生存者のみ発言できます");
  });

  test("WOLF ルームは生存中の人狼のみ発言できる（非人狼は FORBIDDEN）", async () => {
    mockRoomFindUnique.mockResolvedValue(wolfRoom);
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_2, username: "player2", status: "ALIVE", role: "VILLAGER" });

    const caller = createAuthCaller(AUTH_USER_2);
    const err = await caller.game
      .sendMessage({ roomId: ROOM_WOLF, content: "発言テスト" })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toBe("生存中の人狼のみ発言できます");
  });

  test("WOLF ルームは死亡した人狼は発言できない（FORBIDDEN）", async () => {
    mockRoomFindUnique.mockResolvedValue(wolfRoom);
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_1, username: "player1", status: "DEAD", role: "WEREWOLF" });

    const caller = createAuthCaller();
    const err = await caller.game
      .sendMessage({ roomId: ROOM_WOLF, content: "発言テスト" })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toBe("生存中の人狼のみ発言できます");
  });

  test("DEAD ルームは死亡者のみ発言できる（生存者は FORBIDDEN）", async () => {
    mockRoomFindUnique.mockResolvedValue(deadRoom);
    mockPlayerFindFirst.mockResolvedValue({ id: PLAYER_1, username: "player1", status: "ALIVE", role: "VILLAGER" });

    const caller = createAuthCaller();
    const err = await caller.game
      .sendMessage({ roomId: ROOM_DEAD, content: "発言テスト" })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toBe("死亡者のみ発言できます");
  });

  test("ゲーム中でない場合は発言できない（BAD_REQUEST）", async () => {
    mockRoomFindUnique.mockResolvedValue({
      ...mainRoom,
      village: { id: VILLAGE_1, day: 1, status: "ENDED" as const },
    });

    const caller = createAuthCaller();
    const err = await caller.game
      .sendMessage({ roomId: ROOM_MAIN, content: "発言テスト" })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect((err as TRPCError).message).toBe("ゲーム中のみ発言できます");
  });

  test("非参加者は発言できない（FORBIDDEN）", async () => {
    mockRoomFindUnique.mockResolvedValue(mainRoom);
    mockPlayerFindFirst.mockResolvedValue(null);

    const caller = createAuthCaller();
    const err = await caller.game
      .sendMessage({ roomId: ROOM_MAIN, content: "発言テスト" })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toBe("参加者のみ発言できます");
  });
});

// ──────────────────────────────────────────────
// game.results
// ──────────────────────────────────────────────

describe("game.results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("ENDED の村の結果を取得できる", async () => {
    // village.day=2: 処刑でゲーム終了 → 最終日は夜なし
    mockVillageFindUnique.mockResolvedValue({
      day: 2,
      status: "ENDED",
      showVoteTarget: true,
    });
    mockResultFindMany.mockResolvedValue([
      {
        day: 1,
        votedPlayerId: PLAYER_2,
        attackedPlayerId: PLAYER_FT,
        divinedPlayerId: PLAYER_3,
        guardedPlayerId: PLAYER_2,
        votedPlayer: { username: "player2", role: "VILLAGER" },
        attackedPlayer: { username: "fortune", role: "FORTUNE_TELLER" },
        divinedPlayer: { username: "player3", role: "WEREWOLF" },
        guardedPlayer: { username: "player2" },
      },
      {
        day: 2,
        votedPlayerId: PLAYER_1,
        attackedPlayerId: null,
        divinedPlayerId: null,
        guardedPlayerId: null,
        votedPlayer: { username: "player1", role: "WEREWOLF" },
        attackedPlayer: null,
        divinedPlayer: null,
        guardedPlayer: null,
      },
    ]);
    mockRecordFindMany.mockResolvedValue([
      {
        day: 1,
        player: { username: "player1" },
        voteTarget: { username: "player2" },
      },
      {
        day: 1,
        player: { username: "player3" },
        voteTarget: { username: "player2" },
      },
    ]);

    const caller = createPublicCaller();
    const result = await caller.game.results({ villageId: VILLAGE_1 });

    expect(result.showVoteTarget).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].day).toBe(1);
    expect(result.results[0].votedPlayer?.username).toBe("player2");
    expect(result.results[0].hasNightPhase).toBe(true);
    expect(result.results[1].day).toBe(2);
    expect(result.results[1].hasNightPhase).toBe(false);
    expect(result.voteDetails).toHaveLength(2);
  });

  test("処刑でゲーム終了した最終日は hasNightPhase が false になる", async () => {
    // village.day === lastResult.day → 処刑で終了（夜なし）
    mockVillageFindUnique.mockResolvedValue({
      day: 2,
      status: "ENDED",
      showVoteTarget: false,
    });
    mockResultFindMany.mockResolvedValue([
      {
        day: 1,
        votedPlayerId: PLAYER_2,
        attackedPlayerId: PLAYER_FT,
        divinedPlayerId: null,
        guardedPlayerId: null,
        votedPlayer: { username: "player2", role: "VILLAGER" },
        attackedPlayer: { username: "fortune", role: "FORTUNE_TELLER" },
        divinedPlayer: null,
        guardedPlayer: null,
      },
      {
        day: 2,
        votedPlayerId: PLAYER_1,
        attackedPlayerId: null,
        divinedPlayerId: null,
        guardedPlayerId: null,
        votedPlayer: { username: "player1", role: "WEREWOLF" },
        attackedPlayer: null,
        divinedPlayer: null,
        guardedPlayer: null,
      },
    ]);
    mockRecordFindMany.mockResolvedValue([]);

    const caller = createPublicCaller();
    const result = await caller.game.results({ villageId: VILLAGE_1 });

    expect(result.results[0].hasNightPhase).toBe(true);
    expect(result.results[1].hasNightPhase).toBe(false);
  });

  test("夜フェーズ後にゲーム終了した場合は最終日も hasNightPhase が true", async () => {
    // village.day (3) > lastResult.day (2) → 夜経由で終了
    mockVillageFindUnique.mockResolvedValue({
      day: 3,
      status: "ENDED",
      showVoteTarget: true,
    });
    mockResultFindMany.mockResolvedValue([
      {
        day: 2,
        votedPlayerId: PLAYER_2,
        attackedPlayerId: PLAYER_3,
        divinedPlayerId: null,
        guardedPlayerId: null,
        votedPlayer: { username: "player2", role: "VILLAGER" },
        attackedPlayer: { username: "player3", role: "WEREWOLF" },
        divinedPlayer: null,
        guardedPlayer: null,
      },
    ]);
    mockRecordFindMany.mockResolvedValue([]);

    const caller = createPublicCaller();
    const result = await caller.game.results({ villageId: VILLAGE_1 });

    expect(result.results[0].hasNightPhase).toBe(true);
  });

  test("IN_PLAY の村はエラーになる", async () => {
    mockVillageFindUnique.mockResolvedValue({
      day: 1,
      status: "IN_PLAY",
      showVoteTarget: true,
    });

    const caller = createPublicCaller();
    const err = await caller.game
      .results({ villageId: VILLAGE_1 })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
  });

  test("存在しない村はエラーになる", async () => {
    mockVillageFindUnique.mockResolvedValue(null);

    const caller = createPublicCaller();
    const err = await caller.game
      .results({ villageId: NONEXISTENT })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
  });

  test("占い結果の isWerewolf が正しく判定される", async () => {
    mockVillageFindUnique.mockResolvedValue({
      day: 2,
      status: "ENDED",
      showVoteTarget: true,
    });
    mockResultFindMany.mockResolvedValue([
      {
        day: 1,
        votedPlayerId: PLAYER_2,
        attackedPlayerId: null,
        divinedPlayerId: PLAYER_1,
        guardedPlayerId: null,
        votedPlayer: { username: "player2", role: "VILLAGER" },
        attackedPlayer: null,
        divinedPlayer: { username: "player1", role: "WEREWOLF" },
        guardedPlayer: null,
      },
    ]);
    mockRecordFindMany.mockResolvedValue([]);

    const caller = createPublicCaller();
    const result = await caller.game.results({ villageId: VILLAGE_1 });

    expect(result.results[0].divinedPlayer?.isWerewolf).toBe(true);
  });
});
