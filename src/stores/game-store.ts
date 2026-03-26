import { create } from "zustand";
import type { RoomType } from "@/generated/prisma";

interface GameState {
  currentRoom: RoomType;
  showSkillPanel: boolean;
  showResultsPanel: boolean;
  setCurrentRoom: (room: RoomType) => void;
  toggleSkillPanel: () => void;
  setShowSkillPanel: (show: boolean) => void;
  setShowResultsPanel: (show: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentRoom: "MAIN" as RoomType,
  showSkillPanel: false,
  showResultsPanel: false,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  setCurrentRoom: (room) => set({ currentRoom: room, showResultsPanel: false }),
  toggleSkillPanel: () =>
    set((state) => ({ showSkillPanel: !state.showSkillPanel })),
  setShowSkillPanel: (show) => set({ showSkillPanel: show }),
  setShowResultsPanel: (show) => set({ showResultsPanel: show }),
  reset: () => set(initialState),
}));
