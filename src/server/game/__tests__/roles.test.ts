import { describe, expect, test } from "vitest";
import { Role } from "@/generated/prisma";
import { getRoleComposition } from "../roles";

describe("getRoleComposition", () => {
  test("5人構成: 村人3 + 人狼1 + 占い師1", () => {
    const roles = getRoleComposition(5);
    expect(roles).toHaveLength(5);
    expect(roles.filter((r) => r === Role.VILLAGER)).toHaveLength(3);
    expect(roles.filter((r) => r === Role.WEREWOLF)).toHaveLength(1);
    expect(roles.filter((r) => r === Role.FORTUNE_TELLER)).toHaveLength(1);
  });

  test("8人構成: 人狼2 + 占い師 + 騎士 + 狂人を含む", () => {
    const roles = getRoleComposition(8);
    expect(roles).toHaveLength(8);
    expect(roles.filter((r) => r === Role.WEREWOLF)).toHaveLength(2);
    expect(roles.filter((r) => r === Role.FORTUNE_TELLER)).toHaveLength(1);
    expect(roles.filter((r) => r === Role.BODYGUARD)).toHaveLength(1);
    expect(roles.filter((r) => r === Role.MADMAN)).toHaveLength(1);
  });

  test("10人構成: 霊媒師を含む（10人以上で追加）", () => {
    const roles = getRoleComposition(10);
    expect(roles).toHaveLength(10);
    expect(roles.filter((r) => r === Role.PSYCHIC)).toHaveLength(1);
  });

  test("13人構成: 人狼3体", () => {
    const roles = getRoleComposition(13);
    expect(roles).toHaveLength(13);
    expect(roles.filter((r) => r === Role.WEREWOLF)).toHaveLength(3);
  });

  test("16人構成: 最大人数", () => {
    const roles = getRoleComposition(16);
    expect(roles).toHaveLength(16);
    expect(roles.filter((r) => r === Role.WEREWOLF)).toHaveLength(3);
  });

  test("全構成でRole enum値を返す", () => {
    for (let n = 5; n <= 16; n++) {
      const roles = getRoleComposition(n);
      expect(roles).toHaveLength(n);
      roles.forEach((r) => {
        expect(Object.values(Role)).toContain(r);
      });
    }
  });

  test("未定義の人数でエラー", () => {
    expect(() => getRoleComposition(4)).toThrow(
      "No role composition defined for 4 players",
    );
    expect(() => getRoleComposition(17)).toThrow(
      "No role composition defined for 17 players",
    );
  });
});
