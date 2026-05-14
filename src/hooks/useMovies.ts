import { useQuery } from "@tanstack/react-query";
import { getMovies, getMovieFilterOptions } from "@/services/movieService";
import { useMovieFilterStore } from "@/stores/movieFilterStore";

export function useMovies() {
  const { search, tag_ids, actor_ids, genre_ids, series, rating_min, rating_max, watch_status, has_files, sort_by, sort_dir, page, pageSize } =
    useMovieFilterStore();

  return useQuery({
    queryKey: ["movies", { search, tag_ids, actor_ids, genre_ids, series, rating_min, rating_max, watch_status, has_files, sort_by, sort_dir, page, pageSize }],
    queryFn: () =>
      getMovies(
        { search, tag_ids, actor_ids, genre_ids, series, rating_min, rating_max, watch_status, has_files, sort_by, sort_dir },
        page,
        pageSize,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useMovieFilterOptions() {
  return useQuery({
    queryKey: ["movieFilterOptions"],
    queryFn: getMovieFilterOptions,
    staleTime: 60_000,
  });
}
