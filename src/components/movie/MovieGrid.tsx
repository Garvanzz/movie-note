import type { Movie } from "@/types/movie";
import { MovieCard } from "./MovieCard";
import { Skeleton } from "@/components/ui/skeleton";

interface MovieGridProps {
  movies: Movie[];
  isLoading: boolean;
  onDeleteMovie?: (code: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  onOpenPreview?: (code: string) => void;
  selectedMovieCodes?: Set<string>;
  focusedMovieCode?: string | null;
  onToggleSelect?: (code: string, checked: boolean) => void;
}

export function MovieGrid({
  movies,
  isLoading,
  onDeleteMovie,
  emptyTitle = "暂无影片",
  emptyDescription = "尝试调整筛选条件，或添加新影片",
  onOpenPreview,
  selectedMovieCodes,
  focusedMovieCode,
  onToggleSelect,
}: MovieGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[3/4] rounded-lg" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-lg">{emptyTitle}</p>
        <p className="text-sm">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
      {movies.map((movie) => (
        <MovieCard
          key={movie.code}
          movie={movie}
          onDelete={onDeleteMovie}
          onOpenPreview={onOpenPreview}
          selected={selectedMovieCodes?.has(movie.code)}
          focused={focusedMovieCode === movie.code}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
