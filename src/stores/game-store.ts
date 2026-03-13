import { create } from "zustand";
import type { RoomType } from "@/generated/prisma";

interface GameState {
  activeRoomType: RoomType;
  selectedTarget: string | null;
  setActiveRoomType: (type: RoomType) => void;
  setSelectedTarget: (targetId: string | null) => void;
  reset: () => void;
}

const initialState = {
  activeRoomType: "MAIN" as RoomType,
  selectedTarget: null as string | null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  setActiveRoomType: (type) => set({ activeRoomType: type }),
  setSelectedTarget: (targetId) => set({ selectedTarget: targetId }),
  reset: () => set(initialState),
}));
