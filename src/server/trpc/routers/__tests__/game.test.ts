import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockFindUniqueUser,
  mockRoomFindUnique,
  mockPlayerFindUnique,
  mockVillageFindUnique,
  mockPlayerFindMany,
  mockResultFindMany,
  mockPostFindMany,
} = vi.hoisted(() => ({
  mockFindUniqueUser: vi.fn(),
  mockRoomFindUnique: vi.fn(),
  mockPlayerFindUnique: vi.fn(),
  mockVillageFindUnique: vi.fn(),
  mockPlayerFindMany: vi.fn(),
  mockResultFindMany: vi.fn(),
  mockPostFindMany: vi.fn(),
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
    post: { findMany: mockPostFindMany },
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
      post: { findMany: mockPostFindMany },
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
      post: { findMany: mockPostFindMany },
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
