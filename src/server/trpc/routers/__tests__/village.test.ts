import { beforeEach, describe, expect, test, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const { mockFindUniqueUser, mockTransaction } = vi.hoisted(() => ({
  mockFindUniqueUser: vi.fn(),
  mockTransaction: vi.fn(),
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
      $transaction: mockTransaction,
    } as never,
    supabase: {} as never,
    user: { id: "auth-owner-123" },
    headers: new Headers(),
  });
}

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
