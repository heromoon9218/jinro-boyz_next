import { create } from "zustand";

interface GameState {
  currentDay: number;
  isNight: boolean;
  selectedTarget: string | null;
  setCurrentDay: (day: number) => void;
  setIsNight: (isNight: boolean) => void;
  setSelectedTarget: (targetId: string | null) => void;
  reset: () => void;
}

const initialState = {
  currentDay: 0,
  isNight: false,
  selectedTarget: null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  setCurrentDay: (day) => set({ currentDay: day }),
  setIsNight: (isNight) => set({ isNight }),
  setSelectedTarget: (targetId) => set({ selectedTarget: targetId }),
  reset: () => set(initialState),
}));
