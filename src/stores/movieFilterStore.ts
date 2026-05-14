import { create } from "zustand";
import type { MovieFilter } from "@/types/movie";

interface MovieFilterState extends MovieFilter {
  viewMode: "grid" | "table";
  page: number;
  pageSize: number;
  setFilter: (filter: Partial<MovieFilter>) => void;
  resetFilter: () => void;
  setPage: (page: number) => void;
  setViewMode: (mode: "grid" | "table") => void;
  toggleTag: (tagId: number) => void;
  toggleActor: (actorId: number) => void;
  toggleGenre: (genreId: number) => void;
  setSearch: (search: string) => void;
  setSeries: (series: string | undefined) => void;
  setRatingRange: (min: number | undefined, max: number | undefined) => void;
  setWatchStatus: (status: string | undefined) => void;
  setHasFiles: (hasFiles: boolean | undefined) => void;
}

export const useMovieFilterStore = create<MovieFilterState>((set) => ({
  viewMode: "grid",
  page: 1,
  pageSize: 40,

  setFilter: (filter) =>
    set((state) => ({
      ...state,
      ...filter,
      page: 1,
    })),

  resetFilter: () =>
    set({
      search: undefined,
      tag_ids: undefined,
      actor_ids: undefined,
      genre_ids: undefined,
      series: undefined,
      rating_min: undefined,
      rating_max: undefined,
      watch_status: undefined,
      has_files: undefined,
      page: 1,
    }),

  setPage: (page) => set({ page }),
  setViewMode: (viewMode) => set({ viewMode }),

  toggleTag: (tagId) =>
    set((state) => {
      const ids = state.tag_ids ?? [];
      return {
        tag_ids: ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId],
        page: 1,
      };
    }),

  toggleActor: (actorId) =>
    set((state) => {
      const ids = state.actor_ids ?? [];
      return {
        actor_ids: ids.includes(actorId) ? ids.filter((id) => id !== actorId) : [...ids, actorId],
        page: 1,
      };
    }),

  toggleGenre: (genreId) =>
    set((state) => {
      const ids = state.genre_ids ?? [];
      return {
        genre_ids: ids.includes(genreId) ? ids.filter((id) => id !== genreId) : [...ids, genreId],
        page: 1,
      };
    }),

  setSearch: (search) => set({ search: search || undefined, page: 1 }),
  setSeries: (series) => set({ series, page: 1 }),
  setRatingRange: (min, max) => set({ rating_min: min, rating_max: max, page: 1 }),
  setWatchStatus: (watch_status) => set({ watch_status, page: 1 }),
  setHasFiles: (has_files) => set({ has_files, page: 1 }),
}));
