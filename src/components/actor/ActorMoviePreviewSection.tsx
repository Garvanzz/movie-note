import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Star, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assetUrl } from "@/lib/assetUrl";
import { getMovieWatchStatusMeta } from "@/lib/movieWatchStatus";
import { getMovies, removeMovieActor } from "@/services/movieService";
import { toast } from "sonner";

interface ActorMoviePreviewSectionProps {
  actorId: number;
  actorName: string;
  onViewAll: () => void;
}

export function ActorMoviePreviewSection({ actorId, actorName, onViewAll }: ActorMoviePreviewSectionProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unlinkTimersRef = useRef<Map<string, number>>(new Map());
  const [pendingUnlinkCodes, setPendingUnlinkCodes] = useState<Set<string>>(new Set());
  const { data, isLoading } = useQuery({
    queryKey: ["actorMoviePreview", actorId],
    queryFn: () => getMovies({ actor_ids: [actorId], sort_by: "release_date", sort_dir: "desc" }, 1, 8),
    enabled: actorId > 0,
  });

  const movies = data?.items ?? [];
  const visibleMovies = movies.filter((movie) => !pendingUnlinkCodes.has(movie.code));
  const total = data?.total ?? 0;

  useEffect(() => {
    return () => {
      unlinkTimersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      unlinkTimersRef.current.clear();
    };
  }, []);

  const cancelPendingUnlink = (movieCode: string) => {
    const timeoutId = unlinkTimersRef.current.get(movieCode);
    if (timeoutId != null) window.clearTimeout(timeoutId);
    unlinkTimersRef.current.delete(movieCode);
    setPendingUnlinkCodes((previous) => {
      const next = new Set(previous);
      next.delete(movieCode);
      return next;
    });
    toast.success("已撤销移除关联");
  };

  const scheduleUnlink = (movieCode: string) => {
    if (pendingUnlinkCodes.has(movieCode)) return;

    setPendingUnlinkCodes((previous) => new Set(previous).add(movieCode));
    const timeoutId = window.setTimeout(async () => {
      unlinkTimersRef.current.delete(movieCode);
      try {
        await removeMovieActor(movieCode, actorId);
        setPendingUnlinkCodes((previous) => {
          const next = new Set(previous);
          next.delete(movieCode);
          return next;
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["actorMoviePreview", actorId] }),
          queryClient.invalidateQueries({ queryKey: ["movies"] }),
          queryClient.invalidateQueries({ queryKey: ["movieActors"] }),
        ]);
        toast.success("已移除演员与影片的关联");
      } catch (error) {
        setPendingUnlinkCodes((previous) => {
          const next = new Set(previous);
          next.delete(movieCode);
          return next;
        });
        toast.error(`移除关联失败: ${error}`);
      }
    }, 5000);

    unlinkTimersRef.current.set(movieCode, timeoutId);
    toast("关联将在 5 秒后移除", {
      description: `${actorName} 与 ${movieCode} 的关联已加入待处理队列。`,
      action: {
        label: "撤销",
        onClick: () => cancelPendingUnlink(movieCode),
      },
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">作品</h3>
          {!isLoading && <Badge variant="secondary">{total}</Badge>}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onViewAll}>
            全部
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
              <div className="h-4 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : visibleMovies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-lg">暂无作品</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {visibleMovies.map((movie) => {
            const coverSrc = assetUrl(movie.cover_path);
            const watchStatus = getMovieWatchStatusMeta(movie.watch_status);

            return (
              <div
                key={movie.code}
                onClick={() => navigate(`/movies/${encodeURIComponent(movie.code)}`)}
                className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt={movie.title ?? movie.code}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Film className="size-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={pendingUnlinkCodes.has(movie.code)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (confirm(`确定移除 ${actorName} 与影片 \"${movie.code}\" 的关联吗？`)) {
                        scheduleUnlink(movie.code);
                      }
                    }}
                    className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                <div className="space-y-2 p-2.5">
                  <div className="space-y-1">
                    <div className="truncate font-mono text-xs font-semibold text-primary">{movie.code}</div>
                    <div className="line-clamp-2 text-xs text-muted-foreground">{movie.title || "未命名影片"}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="gap-1 px-1.5 py-0.5 text-[10px]">
                      <watchStatus.icon className="size-3" />
                      {watchStatus.label}
                    </Badge>
                    {movie.rating != null && (
                      <span className="inline-flex items-center gap-1 text-yellow-500">
                        <Star className="size-3 fill-yellow-500" />
                        {movie.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}