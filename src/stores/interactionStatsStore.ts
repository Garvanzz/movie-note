import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface InteractionStatsState {
  counts: Record<string, number>;
  increment: (key: string) => void;
  incrementMany: (keys: string[]) => void;
}

const fallbackStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useInteractionStatsStore = create<InteractionStatsState>()(
  persist(
    (set) => ({
      counts: {},
      increment: (key) =>
        set((state) => ({
          counts: { ...state.counts, [key]: (state.counts[key] ?? 0) + 1 },
        })),
      incrementMany: (keys) =>
        set((state) => {
          const nextCounts = { ...state.counts };
          keys.forEach((key) => {
            nextCounts[key] = (nextCounts[key] ?? 0) + 1;
          });
          return { counts: nextCounts };
        }),
    }),
    {
      name: "interaction-stats",
      storage: createJSONStorage(() => (typeof window === "undefined" ? fallbackStorage : localStorage)),
    },
  ),
);