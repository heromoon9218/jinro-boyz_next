import { create } from "zustand";
import type { RoomType } from "@/generated/prisma";

interface GameState {
  currentRoom: RoomType;
  showSkillPanel: boolean;
  setCurrentRoom: (room: RoomType) => void;
  toggleSkillPanel: () => void;
  setShowSkillPanel: (show: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentRoom: "MAIN" as RoomType,
  showSkillPanel: false,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  setCurrentRoom: (room) => set({ currentRoom: room }),
  toggleSkillPanel: () =>
    set((state) => ({ showSkillPanel: !state.showSkillPanel })),
  setShowSkillPanel: (show) => set({ showSkillPanel: show }),
  reset: () => set(initialState),
}));
