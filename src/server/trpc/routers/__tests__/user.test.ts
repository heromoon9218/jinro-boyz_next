import { beforeEach, describe, expect, test, vi } from "vitest";

const DB_USER_1 = "clvdbuser0000000021";
const AUTH_USER_1 = "clauthuser000000031";

const { mockFindUniqueUser, mockProfileUpdate, mockPlayerFindMany } =
  vi.hoisted(() => ({
    mockFindUniqueUser: vi.fn(),
    mockProfileUpdate: vi.fn(),
    mockPlayerFindMany: vi.fn(),
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
    profile: { update: mockProfileUpdate },
    player: { findMany: mockPlayerFindMany },
  },
}));

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "../_app";

const createCaller = createCallerFactory(appRouter);

function createAuthCaller() {
  mockFindUniqueUser.mockResolvedValue({
    id: DB_USER_1,
    authId: AUTH_USER_1,
    username: "player1",
  });
  return createCaller({
    db: {
      user: { findUnique: mockFindUniqueUser },
      profile: { update: mockProfileUpdate },
      player: { findMany: mockPlayerFindMany },
    } as never,
    supabase: {} as never,
    user: { id: AUTH_USER_1 },
    headers: new Headers(),
  });
}

// ──────────────────────────────────────────────
// user.stats
// ──────────────────────────────────────────────

describe("user.stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("役職別の対戦数・勝利数が正しく集計される", async () => {
    mockPlayerFindMany.mockResolvedValue([
      { role: "VILLAGER", village: { winner: "HUMANS" } },
      { role: "VILLAGER", village: { winner: "WEREWOLVES" } },
      { role: "WEREWOLF", village: { winner: "WEREWOLVES" } },
      { role: "MADMAN", village: { winner: "WEREWOLVES" } },
      { role: "FORTUNE_TELLER", village: { winner: "HUMANS" } },
    ]);

    const caller = createAuthCaller();
    const result = await caller.user.stats();

    const villager = result.roleStats.find((s) => s.role === "VILLAGER");
    expect(villager?.played).toBe(2);
    expect(villager?.won).toBe(1);

    const werewolf = result.roleStats.find((s) => s.role === "WEREWOLF");
    expect(werewolf?.played).toBe(1);
    expect(werewolf?.won).toBe(1);

    const madman = result.roleStats.find((s) => s.role === "MADMAN");
    expect(madman?.played).toBe(1);
    expect(madman?.won).toBe(1);

    const fortuneTeller = result.roleStats.find(
      (s) => s.role === "FORTUNE_TELLER",
    );
    expect(fortuneTeller?.played).toBe(1);
    expect(fortuneTeller?.won).toBe(1);

    expect(result.totalPlayed).toBe(5);
    expect(result.totalWon).toBe(4);
  });

  test("対戦がない場合は全て0になる", async () => {
    mockPlayerFindMany.mockResolvedValue([]);

    const caller = createAuthCaller();
    const result = await caller.user.stats();

    expect(result.totalPlayed).toBe(0);
    expect(result.totalWon).toBe(0);
    for (const stat of result.roleStats) {
      expect(stat.played).toBe(0);
      expect(stat.won).toBe(0);
    }
  });

  test("狂人は人狼陣営として勝敗判定される", async () => {
    mockPlayerFindMany.mockResolvedValue([
      { role: "MADMAN", village: { winner: "HUMANS" } },
      { role: "MADMAN", village: { winner: "WEREWOLVES" } },
    ]);

    const caller = createAuthCaller();
    const result = await caller.user.stats();

    const madman = result.roleStats.find((s) => s.role === "MADMAN");
    expect(madman?.played).toBe(2);
    expect(madman?.won).toBe(1);
  });

  test("全役職が roleStats に含まれる", async () => {
    mockPlayerFindMany.mockResolvedValue([]);

    const caller = createAuthCaller();
    const result = await caller.user.stats();

    const roles = result.roleStats.map((s) => s.role);
    expect(roles).toContain("VILLAGER");
    expect(roles).toContain("WEREWOLF");
    expect(roles).toContain("FORTUNE_TELLER");
    expect(roles).toContain("PSYCHIC");
    expect(roles).toContain("BODYGUARD");
    expect(roles).toContain("MADMAN");
  });
});
