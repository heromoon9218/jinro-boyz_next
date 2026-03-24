import { describe, expect, test, vi } from "vitest";
import { Role } from "@/generated/prisma";
import { assignRoles } from "../assign-roles";

describe("assignRoles", () => {
  const playerIds = ["p1", "p2", "p3", "p4", "p5"];

  test("全プレイヤーに役職が割り当てられる", () => {
    const assignments = assignRoles(playerIds);
    expect(assignments.size).toBe(5);
    playerIds.forEach((id) => {
      expect(assignments.has(id)).toBe(true);
    });
  });

  test("割り当てられる役職の構成が正しい", () => {
    const assignments = assignRoles(playerIds);
    const roles = [...assignments.values()].sort();
    const expected = [
      Role.FORTUNE_TELLER,
      Role.VILLAGER,
      Role.VILLAGER,
      Role.VILLAGER,
      Role.WEREWOLF,
    ].sort();
    expect(roles).toEqual(expected);
  });

  test("シャッフルにより役職の順序が変わる", () => {
    // Math.random を制御して、シャッフルが実際に動作することを検証
    const mockRandom = vi.spyOn(Math, "random");

    // 常に0を返す → シャッフルなし（元の順序を維持）
    mockRandom.mockReturnValue(0);
    const unshuffled = assignRoles(playerIds);

    // 常に0.99を返す → 異なるシャッフル結果
    mockRandom.mockReturnValue(0.99);
    const shuffled = assignRoles(playerIds);

    mockRandom.mockRestore();

    const order1 = [...unshuffled.values()].join(",");
    const order2 = [...shuffled.values()].join(",");
    expect(order1).not.toEqual(order2);
  });

  test("8人で割り当て可能", () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    const assignments = assignRoles(ids);
    expect(assignments.size).toBe(8);
    const roles = [...assignments.values()];
    expect(roles.filter((r) => r === Role.WEREWOLF)).toHaveLength(2);
  });

  test("16人で割り当て可能", () => {
    const ids = Array.from({ length: 16 }, (_, i) => `p${i + 1}`);
    const assignments = assignRoles(ids);
    expect(assignments.size).toBe(16);
  });

  test("未対応の人数でエラー", () => {
    expect(() => assignRoles(["p1", "p2", "p3", "p4"])).toThrow(
      "No role composition defined for 4 players",
    );
  });
});
