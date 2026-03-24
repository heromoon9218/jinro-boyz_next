import { describe, expect, test } from "vitest";
import { Role, Winner } from "@/generated/prisma";
import { judgeEnd } from "../judge";

describe("judgeEnd", () => {
  test("人狼が全滅 → HUMANS 勝利", () => {
    const living = [
      { id: "p1", role: Role.VILLAGER },
      { id: "p2", role: Role.FORTUNE_TELLER },
    ];
    expect(judgeEnd(living)).toBe(Winner.HUMANS);
  });

  test("人狼 >= 村人 → WEREWOLVES 勝利（同数）", () => {
    const living = [
      { id: "p1", role: Role.WEREWOLF },
      { id: "p2", role: Role.VILLAGER },
    ];
    expect(judgeEnd(living)).toBe(Winner.WEREWOLVES);
  });

  test("人狼 > 村人 → WEREWOLVES 勝利", () => {
    const living = [
      { id: "p1", role: Role.WEREWOLF },
      { id: "p2", role: Role.WEREWOLF },
      { id: "p3", role: Role.VILLAGER },
    ];
    expect(judgeEnd(living)).toBe(Winner.WEREWOLVES);
  });

  test("人狼 < 村人 → ゲーム続行（null）", () => {
    const living = [
      { id: "p1", role: Role.WEREWOLF },
      { id: "p2", role: Role.VILLAGER },
      { id: "p3", role: Role.FORTUNE_TELLER },
      { id: "p4", role: Role.BODYGUARD },
    ];
    expect(judgeEnd(living)).toBeNull();
  });

  test("全員死亡（空配列）→ HUMANS 勝利（人狼0人）", () => {
    expect(judgeEnd([])).toBe(Winner.HUMANS);
  });

  test("狂人は村人陣営としてカウントされる", () => {
    const living = [
      { id: "p1", role: Role.WEREWOLF },
      { id: "p2", role: Role.MADMAN },
    ];
    // 人狼1, 人間(狂人)1 → 人狼 >= 人間 → WEREWOLVES
    expect(judgeEnd(living)).toBe(Winner.WEREWOLVES);
  });

  test("人狼1 vs 村人2 → ゲーム続行", () => {
    const living = [
      { id: "p1", role: Role.WEREWOLF },
      { id: "p2", role: Role.VILLAGER },
      { id: "p3", role: Role.PSYCHIC },
    ];
    expect(judgeEnd(living)).toBeNull();
  });
});
