import { beforeEach, describe, expect, test, vi } from "vitest";
import { Role } from "@/generated/prisma";

// ── DB mock ──
const mockTransaction = vi.fn();
vi.mock("@/server/db", () => ({
  db: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { proceedDay } from "../proceed-day";

// ── Helpers ──

function makePlayer(
  id: string,
  username: string,
  role: Role,
  status: "ALIVE" | "DEAD" = "ALIVE",
) {
  return {
    id,
    username,
    role,
    status,
    userId: `user-${id}`,
    villageId: "v1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeRecord(
  playerId: string,
  overrides: {
    voteTargetId?: string | null;
    attackTargetId?: string | null;
    divineTargetId?: string | null;
    guardTargetId?: string | null;
  } = {},
) {
  return {
    id: `rec-${playerId}`,
    playerId,
    villageId: "v1",
    day: 1,
    voteTargetId: null,
    attackTargetId: null,
    divineTargetId: null,
    guardTargetId: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

interface TxCalls {
  playerUpdate: ReturnType<typeof vi.fn>;
  postCreate: ReturnType<typeof vi.fn>;
  resultCreate: ReturnType<typeof vi.fn>;
  villageUpdate: ReturnType<typeof vi.fn>;
  recordCreateMany: ReturnType<typeof vi.fn>;
}

function setupTransaction(
  village: Record<string, unknown> | null,
  records: ReturnType<typeof makeRecord>[],
): TxCalls {
  const calls: TxCalls = {
    playerUpdate: vi.fn().mockResolvedValue({}),
    postCreate: vi.fn().mockResolvedValue({}),
    resultCreate: vi.fn().mockResolvedValue({}),
    villageUpdate: vi.fn().mockResolvedValue({}),
    recordCreateMany: vi.fn().mockResolvedValue({}),
  };

  mockTransaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "v1" }]),
        village: {
          findUnique: vi.fn().mockResolvedValue(village),
          update: calls.villageUpdate,
        },
        record: {
          findMany: vi.fn().mockResolvedValue(records),
          createMany: calls.recordCreateMany,
        },
        player: { update: calls.playerUpdate },
        post: { create: calls.postCreate },
        result: { create: calls.resultCreate },
      };
      return fn(tx);
    },
  );

  return calls;
}

// 5人村のベース構成: 人狼1, 占い師1, 騎士1, 村人2
const wolf = makePlayer("wolf1", "ウルフ", Role.WEREWOLF);
const seer = makePlayer("seer1", "占い師", Role.FORTUNE_TELLER);
const guard = makePlayer("guard1", "騎士", Role.BODYGUARD);
const vil1 = makePlayer("vil1", "村人A", Role.VILLAGER);
const vil2 = makePlayer("vil2", "村人B", Role.VILLAGER);

const baseVillage = {
  id: "v1",
  name: "テスト村",
  status: "IN_PLAY",
  day: 1,
  discussionTime: 300,
  showVoteTarget: true,
  nextUpdateTime: new Date(),
  players: [wolf, seer, guard, vil1, vil2],
  rooms: [
    { id: "room-main", type: "MAIN", villageId: "v1" },
    { id: "room-wolf", type: "WOLF", villageId: "v1" },
    { id: "room-dead", type: "DEAD", villageId: "v1" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("proceedDay", () => {
  test("通常フロー: 処刑→夜襲撃→日数進行", async () => {
    const records = [
      makeRecord("wolf1", { voteTargetId: "vil1", attackTargetId: "seer1" }),
      makeRecord("seer1", { voteTargetId: "vil1", divineTargetId: "wolf1" }),
      makeRecord("guard1", { voteTargetId: "vil1", guardTargetId: "vil2" }),
      makeRecord("vil1", { voteTargetId: "wolf1" }),
      makeRecord("vil2", { voteTargetId: "vil1" }),
    ];
    // vil1 が 3票で処刑、seer1 が襲撃される

    const calls = setupTransaction(baseVillage, records);
    await proceedDay("v1");

    // 処刑: vil1 が DEAD に
    expect(calls.playerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vil1" },
        data: { status: "DEAD" },
      }),
    );

    // 襲撃: seer1 が DEAD に（2回目の playerUpdate）
    expect(calls.playerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "seer1" },
        data: { status: "DEAD" },
      }),
    );

    // Result が作成される
    expect(calls.resultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          day: 1,
          villageId: "v1",
          votedPlayerId: "vil1",
          attackedPlayerId: "seer1",
          divinedPlayerId: "wolf1",
          guardedPlayerId: "vil2",
        }),
      }),
    );

    // 日数が進む
    expect(calls.villageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "v1" },
        data: expect.objectContaining({ day: 2 }),
      }),
    );

    // 次の日のレコード作成（生存者: wolf1, guard1, vil2）
    expect(calls.recordCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ playerId: "wolf1", day: 2 }),
          expect.objectContaining({ playerId: "guard1", day: 2 }),
          expect.objectContaining({ playerId: "vil2", day: 2 }),
        ]),
      }),
    );

    // 朝メッセージ
    expect(calls.postCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          day: 2,
          owner: "SYSTEM",
          roomId: "room-main",
        }),
      }),
    );
  });

  test("処刑で人狼全滅 → HUMANS 勝利でゲーム終了", async () => {
    // 3人村: wolf1, vil1, vil2 → wolf1 を処刑
    const village = {
      ...baseVillage,
      players: [wolf, vil1, vil2],
    };
    const records = [
      makeRecord("wolf1", { voteTargetId: "vil1" }),
      makeRecord("vil1", { voteTargetId: "wolf1" }),
      makeRecord("vil2", { voteTargetId: "wolf1" }),
    ];

    const calls = setupTransaction(village, records);
    await proceedDay("v1");

    // 処刑
    expect(calls.playerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wolf1" },
        data: { status: "DEAD" },
      }),
    );

    // ゲーム終了
    expect(calls.villageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ENDED",
          winner: "HUMANS",
          nextUpdateTime: null,
        }),
      }),
    );

    // 夜アクションは実行されない → recordCreateMany は呼ばれない
    expect(calls.recordCreateMany).not.toHaveBeenCalled();
  });

  test("夜襲撃で人狼 >= 村人 → WEREWOLVES 勝利", async () => {
    // 4人: wolf1, vil1, vil2, vil3
    // vil1 処刑 → wolf1, vil2, vil3（1狼 < 2人 → 続行）
    // wolf1 が vil2 を襲撃 → wolf1, vil3（1狼 >= 1人 → WEREWOLVES）
    const vil3 = makePlayer("vil3", "村人C", Role.VILLAGER);
    const village = {
      ...baseVillage,
      players: [wolf, vil1, vil2, vil3],
    };
    const records = [
      makeRecord("wolf1", { voteTargetId: "vil1", attackTargetId: "vil2" }),
      makeRecord("vil1", { voteTargetId: "wolf1" }),
      makeRecord("vil2", { voteTargetId: "vil1" }),
      makeRecord("vil3", { voteTargetId: "vil1" }),
    ];

    const calls = setupTransaction(village, records);
    await proceedDay("v1");

    // vil1 処刑
    expect(calls.playerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vil1" },
        data: { status: "DEAD" },
      }),
    );

    // vil2 襲撃
    expect(calls.playerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vil2" },
        data: { status: "DEAD" },
      }),
    );

    // WEREWOLVES 勝利
    expect(calls.villageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ENDED",
          winner: "WEREWOLVES",
          nextUpdateTime: null,
        }),
      }),
    );
  });

  test("騎士が襲撃対象を護衛 → 誰も死なずに日が進む", async () => {
    const records = [
      makeRecord("wolf1", { voteTargetId: "vil1", attackTargetId: "seer1" }),
      makeRecord("seer1", { voteTargetId: "vil1" }),
      makeRecord("guard1", {
        voteTargetId: "vil1",
        guardTargetId: "seer1",
      }),
      makeRecord("vil1", { voteTargetId: "wolf1" }),
      makeRecord("vil2", { voteTargetId: "vil1" }),
    ];
    // vil1 処刑（3票）、seer1 襲撃だが guard が seer1 を護衛

    const calls = setupTransaction(baseVillage, records);
    await proceedDay("v1");

    // 処刑のみ（playerUpdate 1回だけ）
    expect(calls.playerUpdate).toHaveBeenCalledTimes(1);
    expect(calls.playerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vil1" },
        data: { status: "DEAD" },
      }),
    );

    // Result: attackedPlayerId が null
    expect(calls.resultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attackedPlayerId: null,
        }),
      }),
    );

    // 日が進む
    expect(calls.villageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ day: 2 }),
      }),
    );
  });

  test("処刑された人狼の襲撃アクションは無効", async () => {
    // wolf1 が処刑され、夜の襲撃は実行されない
    // 3人: wolf1, vil1, vil2
    const village = {
      ...baseVillage,
      players: [wolf, vil1, vil2],
    };
    const records = [
      makeRecord("wolf1", { voteTargetId: "vil1", attackTargetId: "vil1" }),
      makeRecord("vil1", { voteTargetId: "wolf1" }),
      makeRecord("vil2", { voteTargetId: "wolf1" }),
    ];
    // wolf1 が 2票で処刑 → 残り: vil1, vil2 → 人狼0 → HUMANS 勝利（処刑時点で判定）

    const calls = setupTransaction(village, records);
    await proceedDay("v1");

    // wolf1 処刑
    expect(calls.playerUpdate).toHaveBeenCalledTimes(1);
    expect(calls.playerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wolf1" },
        data: { status: "DEAD" },
      }),
    );

    // 処刑後に HUMANS 勝利 → 夜フェーズに入らない
    expect(calls.villageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ENDED",
          winner: "HUMANS",
        }),
      }),
    );
  });

  test("投票なしの場合、ランダム処刑のシステムメッセージが投稿される", async () => {
    const records = [
      makeRecord("wolf1", { attackTargetId: "seer1" }),
      makeRecord("seer1"),
      makeRecord("guard1"),
      makeRecord("vil1"),
      makeRecord("vil2"),
    ];

    const calls = setupTransaction(baseVillage, records);
    await proceedDay("v1");

    // 処刑は発生（誰かが処刑される）
    expect(calls.playerUpdate).toHaveBeenCalled();

    // noVoteMessage が投稿される（最初の postCreate）
    const firstPost = calls.postCreate.mock.calls[0][0];
    expect(firstPost.data.content).toContain("投票がありませんでした");
    expect(firstPost.data.owner).toBe("SYSTEM");
  });

  test("IN_PLAY 以外の村では何もしない", async () => {
    const endedVillage = { ...baseVillage, status: "ENDED" };
    const calls = setupTransaction(endedVillage, []);
    await proceedDay("v1");

    expect(calls.playerUpdate).not.toHaveBeenCalled();
    expect(calls.villageUpdate).not.toHaveBeenCalled();
  });

  test("村が存在しない場合は何もしない", async () => {
    const calls = setupTransaction(null, []);
    await proceedDay("v1");

    expect(calls.playerUpdate).not.toHaveBeenCalled();
    expect(calls.villageUpdate).not.toHaveBeenCalled();
  });
});
