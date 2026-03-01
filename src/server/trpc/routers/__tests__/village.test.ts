import { beforeEach, describe, expect, test, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const { mockFindUniqueUser, mockTransaction, mockVillageFindUnique } = vi.hoisted(() => ({
  mockFindUniqueUser: vi.fn(),
  mockTransaction: vi.fn(),
  mockVillageFindUnique: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "auth-owner-123" } },
        }),
      },
    }),
  ),
}));

vi.mock("@/server/db", () => ({
  db: {
    user: { findUnique: mockFindUniqueUser },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "../_app";

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(dbUserId: string) {
  mockFindUniqueUser.mockResolvedValue({
    id: dbUserId,
    authId: "auth-owner-123",
    username: "owner",
  });
  return createCaller({
    db: {
      user: { findUnique: mockFindUniqueUser },
      village: { findUnique: mockVillageFindUnique },
      $transaction: mockTransaction,
    } as never,
    supabase: {} as never,
    user: { id: "auth-owner-123" },
    headers: new Headers(),
  });
}

function createPublicCaller() {
  return createCaller({
    db: {
      user: { findUnique: mockFindUniqueUser },
      village: { findUnique: mockVillageFindUnique },
      $transaction: mockTransaction,
    } as never,
    supabase: {} as never,
    user: null,
    headers: new Headers(),
  });
}

const baseVillageWithPlayers = {
  id: "village-1",
  name: "テスト村",
  playerNum: 2,
  discussionTime: 300,
  day: 1,
  accessPassword: null as string | null,
  showVoteTarget: true,
  scheduledStartAt: null as Date | null,
  startAt: null as Date | null,
  nextUpdateTime: null as Date | null,
  userId: "db-owner-123",
  createdAt: new Date(),
  updatedAt: new Date(),
  user: {
    id: "db-owner-123",
    username: "owner",
    authId: "auth-owner-123",
  },
  players: [
    {
      id: "player-1",
      username: "player1",
      userId: "db-user-1",
      villageId: "village-1",
      role: "WEREWOLF" as const,
      status: "ALIVE" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: "db-user-1", username: "player1", authId: "auth-user-1" },
    },
    {
      id: "player-2",
      username: "player2",
      userId: "db-user-2",
      villageId: "village-1",
      role: "VILLAGER" as const,
      status: "ALIVE" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: "db-user-2", username: "player2", authId: "auth-user-2" },
    },
  ],
};

describe("village.byId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("IN_PLAY の村では players に role が含まれない", async () => {
    mockVillageFindUnique.mockResolvedValue({
      ...baseVillageWithPlayers,
      status: "IN_PLAY",
    });

    const caller = createPublicCaller();
    const result = await caller.village.byId({ id: "village-1" });

    expect(result.players).toHaveLength(2);
    for (const player of result.players) {
      expect(player).not.toHaveProperty("role");
    }
  });

  test("NOT_STARTED の村では players に role が含まれない", async () => {
    mockVillageFindUnique.mockResolvedValue({
      ...baseVillageWithPlayers,
      status: "NOT_STARTED",
    });

    const caller = createPublicCaller();
    const result = await caller.village.byId({ id: "village-1" });

    expect(result.players).toHaveLength(2);
    for (const player of result.players) {
      expect(player).not.toHaveProperty("role");
    }
  });

  test("ENDED の村では players に role が含まれる", async () => {
    mockVillageFindUnique.mockResolvedValue({
      ...baseVillageWithPlayers,
      status: "ENDED",
    });

    const caller = createPublicCaller();
    const result = await caller.village.byId({ id: "village-1" });

    expect(result.players).toHaveLength(2);
    expect(result.players[0]).toHaveProperty("role", "WEREWOLF");
    expect(result.players[1]).toHaveProperty("role", "VILLAGER");
  });

  test("RUINED の村では players に role が含まれる（廃村後は結果表示のため公開）", async () => {
    mockVillageFindUnique.mockResolvedValue({
      ...baseVillageWithPlayers,
      status: "RUINED",
    });

    const caller = createPublicCaller();
    const result = await caller.village.byId({ id: "village-1" });

    expect(result.players).toHaveLength(2);
    expect(result.players[0]).toHaveProperty("role", "WEREWOLF");
    expect(result.players[1]).toHaveProperty("role", "VILLAGER");
  });

  test("村が存在しない場合、NOT_FOUND を返す", async () => {
    mockVillageFindUnique.mockResolvedValue(null);

    const caller = createPublicCaller();
    const err = await caller.village.byId({ id: "nonexistent" }).catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
    expect((err as TRPCError).message).toBe("村が見つかりません");
  });
});

describe("village.kick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("別の村のプレイヤーを指定した場合、NOT_FOUND で拒否される", async () => {
    const caller = await createAuthenticatedCaller("db-owner-123");

    // 村主の村（village-A）は存在し、村主がオーナー
    const mockVillageFindUnique = vi.fn().mockResolvedValue({
      status: "NOT_STARTED",
      userId: "db-owner-123",
    });
    // プレイヤーは別の村（village-B）に所属 → findFirst(id, villageId) で null
    const mockPlayerFindFirst = vi.fn().mockResolvedValue(null);

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        village: { findUnique: mockVillageFindUnique },
        player: { findFirst: mockPlayerFindFirst, delete: vi.fn() },
        blacklistUser: { create: vi.fn() },
      };
      return fn(tx);
    });

    const err = await caller.village
      .kick({
        villageId: "village-A",
        playerId: "player-in-village-B",
      })
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
    expect((err as TRPCError).message).toBe("プレイヤーが見つかりません");

    // findFirst が villageId 込みで呼ばれていることを検証
    expect(mockPlayerFindFirst).toHaveBeenCalledWith({
      where: {
        id: "player-in-village-B",
        villageId: "village-A",
      },
      select: { id: true, userId: true },
    });
  });
});
