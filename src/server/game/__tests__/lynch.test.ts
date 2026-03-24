import { describe, expect, test } from "vitest";
import { determineLynchTarget } from "../lynch";

const alive = ["p1", "p2", "p3", "p4"];

describe("determineLynchTarget", () => {
  test("単独最多得票のプレイヤーが処刑される", () => {
    const votes = [
      { voterId: "p1", targetId: "p3" },
      { voterId: "p2", targetId: "p3" },
      { voterId: "p3", targetId: "p1" },
    ];
    expect(determineLynchTarget(votes, alive)).toBe("p3");
  });

  test("同数票の場合、同数票のプレイヤーの中からランダムで選ばれる", () => {
    const votes = [
      { voterId: "p1", targetId: "p2" },
      { voterId: "p2", targetId: "p1" },
    ];
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(determineLynchTarget(votes, alive));
    }
    // 同数票の p1, p2 のみが選ばれるはず
    for (const r of results) {
      expect(["p1", "p2"]).toContain(r);
    }
    // ランダムなので両方出現するはず（確率的に極めて高い）
    expect(results.size).toBe(2);
  });

  test("投票なしの場合、生存者からランダムで選ばれる", () => {
    const results = new Set<string>();
    for (let i = 0; i < 200; i++) {
      results.add(determineLynchTarget([], alive));
    }
    for (const r of results) {
      expect(alive).toContain(r);
    }
    expect(results.size).toBeGreaterThanOrEqual(2);
  });

  test("全員が同一プレイヤーに投票した場合、そのプレイヤーが処刑される", () => {
    const votes = [
      { voterId: "p1", targetId: "p4" },
      { voterId: "p2", targetId: "p4" },
      { voterId: "p3", targetId: "p4" },
    ];
    expect(determineLynchTarget(votes, alive)).toBe("p4");
  });

  test("3人が同数票の場合、その3人の中から選ばれる", () => {
    const votes = [
      { voterId: "p1", targetId: "p2" },
      { voterId: "p2", targetId: "p3" },
      { voterId: "p3", targetId: "p1" },
    ];
    const results = new Set<string>();
    for (let i = 0; i < 200; i++) {
      results.add(determineLynchTarget(votes, alive));
    }
    for (const r of results) {
      expect(["p1", "p2", "p3"]).toContain(r);
    }
  });

  test("生存者が空配列の場合、投票なし時にエラーが発生する", () => {
    expect(() => determineLynchTarget([], [])).toThrow(
      "pickRandom called with empty array",
    );
  });
});
