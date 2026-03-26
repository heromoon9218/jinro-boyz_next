import { describe, test, expect, beforeEach } from "vitest";
import { useGameStore } from "../game-store";

describe("useGameStore", () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  test("初期状態: currentRoom が MAIN、showSkillPanel/showResultsPanel が false", () => {
    const state = useGameStore.getState();
    expect(state.currentRoom).toBe("MAIN");
    expect(state.showSkillPanel).toBe(false);
    expect(state.showResultsPanel).toBe(false);
  });

  test("setCurrentRoom('WOLF') → currentRoom が WOLF に変わる", () => {
    useGameStore.getState().setCurrentRoom("WOLF");
    expect(useGameStore.getState().currentRoom).toBe("WOLF");
  });

  test("toggleSkillPanel() → showSkillPanel が true にトグルする", () => {
    useGameStore.getState().toggleSkillPanel();
    expect(useGameStore.getState().showSkillPanel).toBe(true);
  });

  test("toggleSkillPanel() 2回 → showSkillPanel が false に戻る", () => {
    useGameStore.getState().toggleSkillPanel();
    useGameStore.getState().toggleSkillPanel();
    expect(useGameStore.getState().showSkillPanel).toBe(false);
  });

  test("setShowSkillPanel(true) → showSkillPanel が true に設定される", () => {
    useGameStore.getState().setShowSkillPanel(true);
    expect(useGameStore.getState().showSkillPanel).toBe(true);
  });

  test("setShowSkillPanel(false) → showSkillPanel が false のまま", () => {
    useGameStore.getState().setShowSkillPanel(true);
    useGameStore.getState().setShowSkillPanel(false);
    expect(useGameStore.getState().showSkillPanel).toBe(false);
  });

  test("setShowResultsPanel(true) → showResultsPanel が true に設定される", () => {
    useGameStore.getState().setShowResultsPanel(true);
    expect(useGameStore.getState().showResultsPanel).toBe(true);
  });

  test("setCurrentRoom → showResultsPanel が false にリセットされる", () => {
    useGameStore.getState().setShowResultsPanel(true);
    useGameStore.getState().setCurrentRoom("WOLF");
    expect(useGameStore.getState().showResultsPanel).toBe(false);
    expect(useGameStore.getState().currentRoom).toBe("WOLF");
  });

  test("reset() → 初期状態に戻る", () => {
    useGameStore.getState().setCurrentRoom("WOLF");
    useGameStore.getState().setShowSkillPanel(true);
    useGameStore.getState().setShowResultsPanel(true);
    useGameStore.getState().reset();
    const state = useGameStore.getState();
    expect(state.currentRoom).toBe("MAIN");
    expect(state.showSkillPanel).toBe(false);
    expect(state.showResultsPanel).toBe(false);
  });
});
