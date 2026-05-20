import { useNavigate } from "react-router-dom";
import { Eye, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Movie } from "@/types/movie";
import { getMovieWatchStatusMeta } from "@/lib/movieWatchStatus";

interface MovieTableProps {
  movies: Movie[];
  isLoading: boolean;
  onDeleteMovie?: (code: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  onOpenPreview?: (code: string) => void;
  selectedMovieCodes?: Set<string>;
  focusedMovieCode?: string | null;
  onToggleSelect?: (code: string, checked: boolean) => void;
  onToggleSelectAll?: (checked: boolean) => void;
}

export function MovieTable({
  movies,
  isLoading,
  onDeleteMovie,
  emptyTitle = "暂无影片",
  emptyDescription = "尝试调整筛选条件，或添加新影片",
  onOpenPreview,
  selectedMovieCodes,
  focusedMovieCode,
  onToggleSelect,
  onToggleSelectAll,
}: MovieTableProps) {
  const navigate = useNavigate();
  const allSelected = movies.length > 0 && movies.every((movie) => selectedMovieCodes?.has(movie.code));

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card/40">
        <div className="grid grid-cols-[36px_1.1fr_2fr_1fr_0.8fr_0.9fr_1.1fr_96px] gap-4 border-b border-border px-4 py-3 text-xs text-muted-foreground">
          <span />
          <span>番号</span>
          <span>标题</span>
          <span>发行日期</span>
          <span>评分</span>
          <span>状态</span>
          <span>更新时间</span>
          <span className="text-right">操作</span>
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[36px_1.1fr_2fr_1fr_0.8fr_0.9fr_1.1fr_96px] gap-4 border-b border-border/70 px-4 py-3 text-sm last:border-b-0">
            {Array.from({ length: 8 }).map((__, cellIndex) => (
              <div key={cellIndex} className="h-4 animate-pulse rounded bg-muted" />
            ))}
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
    <div className="overflow-hidden rounded-xl border border-border bg-card/40">
      <div className="grid grid-cols-[36px_1.1fr_2fr_1fr_0.8fr_0.9fr_1.1fr_96px] gap-4 border-b border-border bg-card/60 px-4 py-3 text-xs font-medium text-muted-foreground">
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => onToggleSelectAll?.(event.target.checked)}
          />
        </label>
        <span>番号</span>
        <span>标题</span>
        <span>发行日期</span>
        <span>评分</span>
        <span>状态</span>
        <span>更新时间</span>
        <span className="text-right">操作</span>
      </div>

      {movies.map((movie) => (
        (() => {
          const watchStatus = getMovieWatchStatusMeta(movie.watch_status);

          return (
            <div
              key={movie.code}
              onClick={() => navigate(`/movies/${encodeURIComponent(movie.code)}`)}
              className={[
                "grid cursor-pointer grid-cols-[36px_1.1fr_2fr_1fr_0.8fr_0.9fr_1.1fr_96px] gap-4 border-b border-border/70 px-4 py-3 text-sm transition-colors hover:bg-accent/40 last:border-b-0",
                focusedMovieCode === movie.code ? "bg-amber-500/10 ring-1 ring-inset ring-amber-400/40" : "",
              ].join(" ")}
            >
              <label className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={selectedMovieCodes?.has(movie.code) ?? false}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onToggleSelect?.(movie.code, event.target.checked)}
                />
              </label>
              <span className="truncate font-mono font-semibold text-primary">{movie.code}</span>
              <div className="min-w-0">
                <div className="truncate">{movie.title || "未命名影片"}</div>
                {movie.title_jp && <div className="truncate text-xs text-muted-foreground">{movie.title_jp}</div>}
              </div>
              <span className="text-muted-foreground">{movie.release_date || "-"}</span>
              <span className="inline-flex items-center gap-1 text-yellow-500">
                {movie.rating != null ? (
                  <>
                    <Star className="size-3.5 fill-yellow-500" />
                    {movie.rating.toFixed(1)}
                  </>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <watchStatus.icon className="size-3.5" />
                {watchStatus.label}
              </span>
              <span className="text-muted-foreground">{formatDateTime(movie.updated_at)}</span>
              <div className="flex justify-end gap-1">
                {onOpenPreview && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenPreview(movie.code);
                    }}
                  >
                    <Eye className="size-3.5 text-muted-foreground" />
                  </Button>
                )}
                {onDeleteMovie ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteMovie(movie.code);
                    }}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            </div>
          );
        })()
      ))}
    </div>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}