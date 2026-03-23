import { describe, expect, test, vi } from "vitest";
import { determineLynchTarget } from "../lynch";

describe("determineLynchTarget", () => {
  test("最多得票者を処刑する", () => {
    const result = determineLynchTarget([
      { voterId: "v1", targetId: "A" },
      { voterId: "v2", targetId: "A" },
      { voterId: "v3", targetId: "B" },
    ]);
    expect(result).toBe("A");
  });

  test("同数票の場合はランダムに1人を選出する", () => {
    // Math.random を固定して "B" が選ばれるようにする
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.99);

    const result = determineLynchTarget([
      { voterId: "v1", targetId: "A" },
      { voterId: "v2", targetId: "B" },
    ]);

    // topTargets は ["A", "B"] → floor(0.99 * 2) = 1 → "B"
    expect(result).toBe("B");
    spy.mockRestore();
  });

  test("同数票でランダム値が小さい場合は先頭が選ばれる", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.0);

    const result = determineLynchTarget([
      { voterId: "v1", targetId: "A" },
      { voterId: "v2", targetId: "B" },
    ]);

    expect(result).toBe("A");
    spy.mockRestore();
  });

  test("投票なし＋fallbackありの場合はランダムに処刑する", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    const result = determineLynchTarget([], ["X", "Y", "Z"]);

    // floor(0.5 * 3) = 1 → "Y"
    expect(result).toBe("Y");
    spy.mockRestore();
  });

  test("投票なし＋fallbackなしの場合はnullを返す", () => {
    const result = determineLynchTarget([]);
    expect(result).toBeNull();
  });

  test("投票なし＋空のfallback配列の場合はnullを返す", () => {
    const result = determineLynchTarget([], []);
    expect(result).toBeNull();
  });

  test("全員が同じ対象に投票した場合はその対象が処刑される", () => {
    const result = determineLynchTarget([
      { voterId: "v1", targetId: "A" },
      { voterId: "v2", targetId: "A" },
      { voterId: "v3", targetId: "A" },
    ]);
    expect(result).toBe("A");
  });

  test("3人が同数票の場合もランダムに1人を選出する", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.67);

    const result = determineLynchTarget([
      { voterId: "v1", targetId: "A" },
      { voterId: "v2", targetId: "B" },
      { voterId: "v3", targetId: "C" },
    ]);

    // topTargets は ["A", "B", "C"] → floor(0.67 * 3) = 2 → "C"
    expect(result).toBe("C");
    spy.mockRestore();
  });
});
