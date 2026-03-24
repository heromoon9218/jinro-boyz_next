import { describe, expect, test } from "vitest";
import { resolveAttack } from "../attack";

describe("resolveAttack", () => {
  test("襲撃あり・護衛なし → 襲撃成功", () => {
    expect(
      resolveAttack({ attackTargetId: "p1", guardTargetId: null }),
    ).toBe("p1");
  });

  test("襲撃あり・護衛が同一対象 → 護衛成功（null）", () => {
    expect(
      resolveAttack({ attackTargetId: "p1", guardTargetId: "p1" }),
    ).toBeNull();
  });

  test("襲撃あり・護衛が別対象 → 襲撃成功", () => {
    expect(
      resolveAttack({ attackTargetId: "p1", guardTargetId: "p2" }),
    ).toBe("p1");
  });

  test("襲撃なし → null", () => {
    expect(
      resolveAttack({ attackTargetId: null, guardTargetId: null }),
    ).toBeNull();
  });

  test("襲撃なし・護衛あり → null", () => {
    expect(
      resolveAttack({ attackTargetId: null, guardTargetId: "p1" }),
    ).toBeNull();
  });
});
