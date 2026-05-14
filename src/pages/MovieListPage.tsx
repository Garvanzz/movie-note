import { useState, useEffect } from "react";
import { LayoutGrid, Table2, Plus, Loader2, Globe } from "lucide-react";
import { MovieFilterSidebar } from "@/components/movie/MovieFilterSidebar";
import { MovieGrid } from "@/components/movie/MovieGrid";
import { ScraperDialog } from "@/components/scraper/ScraperDialog";
import { Button } from "@/components/ui/button";
import { useMovies } from "@/hooks/useMovies";
import { useMovieFilterStore } from "@/stores/movieFilterStore";
import { cn } from "@/lib/utils";

export function MovieListPage() {
  const { data, isLoading, isFetching } = useMovies();
  const { viewMode, setViewMode, page, setPage, pageSize } = useMovieFilterStore();
  const movies = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [scraperOpen, setScraperOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        document.getElementById("movie-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-full -m-6">
      <MovieFilterSidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">影片</h1>
            {isFetching && !isLoading && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            {total > 0 && (
              <span className="text-sm text-muted-foreground">
                共 {total} 部
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-1.5", viewMode === "grid" ? "bg-accent" : "hover:bg-accent/50")}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={cn("p-1.5", viewMode === "table" ? "bg-accent" : "hover:bg-accent/50")}
              >
                <Table2 className="size-4" />
              </button>
            </div>

            <Button size="sm" variant="outline" onClick={() => setScraperOpen(true)}>
              <Globe className="size-4" />
              刮削
            </Button>
            <Button size="sm">
              <Plus className="size-4" />
              添加
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {viewMode === "grid" ? (
            <MovieGrid movies={movies} isLoading={isLoading} />
          ) : (
            <div className="text-center py-24 text-muted-foreground">
              表格视图即将上线
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8 pb-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      </div>

      {scraperOpen && <ScraperDialog onClose={() => setScraperOpen(false)} />}
    </div>
  );
}
