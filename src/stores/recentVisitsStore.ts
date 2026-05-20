import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MovieFilter } from "@/types/movie";

export interface RecentVisitItem {
  key: string;
  type: "movie" | "actor" | "filter";
  title: string;
  subtitle?: string;
  href?: string;
  filter?: Partial<MovieFilter>;
  timestamp: number;
}

interface RecentVisitsState {
  items: RecentVisitItem[];
  addVisit: (visit: Omit<RecentVisitItem, "timestamp">) => void;
  clearVisits: () => void;
}

const fallbackStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useRecentVisitsStore = create<RecentVisitsState>()(
  persist(
    (set) => ({
      items: [],
      addVisit: (visit) =>
        set((state) => ({
          items: [
            { ...visit, timestamp: Date.now() },
            ...state.items.filter((item) => item.key !== visit.key),
          ].slice(0, 12),
        })),
      clearVisits: () => set({ items: [] }),
    }),
    {
      name: "recent-visits",
      storage: createJSONStorage(() => (typeof window === "undefined" ? fallbackStorage : localStorage)),
    },
  ),
);