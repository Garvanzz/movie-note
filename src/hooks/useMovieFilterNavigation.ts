import { useNavigate } from "react-router-dom";
import { useInteractionStatsStore } from "@/stores/interactionStatsStore";
import { useMovieFilterStore } from "@/stores/movieFilterStore";
import { useRecentVisitsStore } from "@/stores/recentVisitsStore";
import { createFilterKey, describeFilter, getInteractionKeys } from "@/lib/movieFilterNavigation";
import type { MovieFilter } from "@/types/movie";

export function useMovieFilterNavigation() {
  const navigate = useNavigate();
  const resetFilter = useMovieFilterStore((state) => state.resetFilter);
  const setFilter = useMovieFilterStore((state) => state.setFilter);
  const addVisit = useRecentVisitsStore((state) => state.addVisit);
  const incrementMany = useInteractionStatsStore((state) => state.incrementMany);

  return (filter: Partial<MovieFilter>, meta?: { title?: string; subtitle?: string }) => {
    resetFilter();
    setFilter(filter);
    incrementMany(getInteractionKeys(filter));
    addVisit({
      key: `filter:${createFilterKey(filter)}`,
      type: "filter",
      title: meta?.title ?? describeFilter(filter),
      subtitle: meta?.subtitle ?? "影片筛选",
      filter,
    });
    navigate("/");
  };
}
