import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, Globe, Keyboard, LayoutGrid, Loader2, Plus, Table2, X } from "lucide-react";
import { MovieFilterSidebar } from "@/components/movie/MovieFilterSidebar";
import { MovieGrid } from "@/components/movie/MovieGrid";
import { MovieQuickPreviewPanel } from "@/components/movie/MovieQuickPreviewPanel";
import { MovieTable } from "@/components/movie/MovieTable";
import { AddMovieDialog } from "@/components/movie/AddMovieDialog";
import { ScraperDialog } from "@/components/scraper/ScraperDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMovieFilterOptions, useMovies } from "@/hooks/useMovies";
import { useMovieFilterStore } from "@/stores/movieFilterStore";
import { deleteMovie, updateMovie } from "@/services/movieService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getMovieWatchStatusMeta } from "@/lib/movieWatchStatus";

const SORT_OPTIONS = [
  { value: "created_at:desc", label: "近期入库" },
  { value: "updated_at:desc", label: "最近整理" },
  { value: "release_date:desc", label: "最新发行" },
  { value: "rating:desc", label: "评分最高" },
  { value: "code:asc", label: "番号排序" },
] as const;

interface ActiveFilterItem {
  key: string;
  label: string;
  onRemove: () => void;
  onKeepOnly: () => void;
}

const MOVIE_LIST_SCROLL_KEY = "movie-list-scroll-top";

const SHORTCUT_HINTS = ["Ctrl+F 搜索", "J/K 聚焦", "Enter 详情", "P 预览", "Space 选择", "Delete 删除"] as const;

export function MovieListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useMovies();
  const { data: filterOptions } = useMovieFilterOptions();
  const {
    search,
    tag_ids,
    actor_ids,
    genre_ids,
    series,
    rating_min,
    rating_max,
    watch_status,
    has_files,
    viewMode,
    setViewMode,
    page,
    setPage,
    pageSize,
    sort_by,
    sort_dir,
    setSort,
    setSearch,
    resetFilter,
    toggleTag,
    toggleActor,
    toggleGenre,
    setSeries,
    setRatingRange,
    setWatchStatus,
    setHasFiles,
  } = useMovieFilterStore();
  const movies = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [scraperOpen, setScraperOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [selectedMovieCodes, setSelectedMovieCodes] = useState<Set<string>>(new Set());
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [focusedMovieCode, setFocusedMovieCode] = useState<string | null>(null);
  const [pendingDeleteCodes, setPendingDeleteCodes] = useState<Set<string>>(new Set());
  const [deleteConfirmCodes, setDeleteConfirmCodes] = useState<string[] | null>(null);
  const deleteTimersRef = useRef<Map<string, number>>(new Map());
  const pendingDeleteQueuesRef = useRef<Map<string, string[]>>(new Map());
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const visibleMovies = useMemo(
    () => movies.filter((movie) => !pendingDeleteCodes.has(movie.code)),
    [movies, pendingDeleteCodes],
  );
  const sortValue = `${sort_by ?? "created_at"}:${(sort_dir ?? "desc").toLowerCase()}`;
  const activeSortOption = SORT_OPTIONS.find((option) => option.value === sortValue) ?? SORT_OPTIONS[0];
  const tagsById = new Map((filterOptions?.tags ?? []).map((option) => [Number(option.value), option.label]));
  const actorsById = new Map((filterOptions?.actors ?? []).map((option) => [Number(option.value), option.label]));
  const genresById = new Map((filterOptions?.genres ?? []).map((option) => [Number(option.value), option.label]));
  const activeFilters: ActiveFilterItem[] = [
    search
      ? {
          key: `search:${search}`,
          label: `搜索: ${search}`,
          onRemove: () => setSearch(""),
          onKeepOnly: () => {
            resetFilter();
            setSearch(search);
          },
        }
      : null,
    watch_status
      ? {
          key: `watch:${watch_status}`,
          label: `观看状态: ${getMovieWatchStatusMeta(watch_status).label}`,
          onRemove: () => setWatchStatus(undefined),
          onKeepOnly: () => {
            resetFilter();
            setWatchStatus(watch_status);
          },
        }
      : null,
    has_files != null
      ? {
          key: `files:${has_files}`,
          label: has_files ? "文件: 有文件" : "文件: 无文件",
          onRemove: () => setHasFiles(undefined),
          onKeepOnly: () => {
            resetFilter();
            setHasFiles(has_files);
          },
        }
      : null,
    series
      ? {
          key: `series:${series}`,
          label: `系列: ${series}`,
          onRemove: () => setSeries(undefined),
          onKeepOnly: () => {
            resetFilter();
            setSeries(series);
          },
        }
      : null,
    rating_min != null || rating_max != null
      ? {
          key: `rating:${rating_min ?? ""}:${rating_max ?? ""}`,
          label: `评分: ${rating_min != null ? `${rating_min.toFixed(1)}+` : `<=${rating_max?.toFixed(1)}`}`,
          onRemove: () => setRatingRange(undefined, undefined),
          onKeepOnly: () => {
            resetFilter();
            setRatingRange(rating_min, rating_max);
          },
        }
      : null,
    ...(tag_ids ?? []).map((tagId) => ({
      key: `tag:${tagId}`,
      label: `标签: ${tagsById.get(tagId) ?? tagId}`,
      onRemove: () => toggleTag(tagId),
      onKeepOnly: () => {
        resetFilter();
        toggleTag(tagId);
      },
    })),
    ...(actor_ids ?? []).map((actorId) => ({
      key: `actor:${actorId}`,
      label: `演员: ${actorsById.get(actorId) ?? actorId}`,
      onRemove: () => toggleActor(actorId),
      onKeepOnly: () => {
        resetFilter();
        toggleActor(actorId);
      },
    })),
    ...(genre_ids ?? []).map((genreId) => ({
      key: `genre:${genreId}`,
      label: `类型: ${genresById.get(genreId) ?? genreId}`,
      onRemove: () => toggleGenre(genreId),
      onKeepOnly: () => {
        resetFilter();
        toggleGenre(genreId);
      },
    })),
  ].filter((item): item is ActiveFilterItem => item !== null);
  const hasActiveFilters = activeFilters.length > 0;

  const bulkWatchMutation = useMutation({
    mutationFn: async (status: "unwatched" | "watched") => {
      await Promise.all(Array.from(selectedMovieCodes).map((movieCode) => updateMovie(movieCode, { watch_status: status })));
    },
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      setSelectedMovieCodes(new Set());
      toast.success(status === "watched" ? "已批量标记为已观看" : "已批量标记为未观看");
    },
    onError: (error) => toast.error(`批量更新失败: ${error}`),
  });

  useEffect(() => {
    return () => {
      deleteTimersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      deleteTimersRef.current.clear();
      pendingDeleteQueuesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!sortMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !sortMenuRef.current?.contains(target)) {
        setSortMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSortMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sortMenuOpen]);

  useEffect(() => {
    if (!deleteConfirmCodes) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeleteConfirmCodes(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteConfirmCodes]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = Boolean(
        target && (target.closest("input, textarea, select, [contenteditable='true']") || target.isContentEditable),
      );

      if ((event.ctrlKey || event.metaKey) && event.key === "f") {
        event.preventDefault();
        document.getElementById("movie-search")?.focus();
        return;
      }

      if (isTyping || visibleMovies.length === 0) return;

      const currentIndex = Math.max(0, visibleMovies.findIndex((movie) => movie.code === focusedMovieCode));
      const currentMovie = visibleMovies[currentIndex] ?? visibleMovies[0];

      if ((event.key === "ArrowDown" || event.key === "j") && visibleMovies[currentIndex + 1]) {
        event.preventDefault();
        setFocusedMovieCode(visibleMovies[currentIndex + 1].code);
        return;
      }

      if ((event.key === "ArrowUp" || event.key === "k") && visibleMovies[currentIndex - 1]) {
        event.preventDefault();
        setFocusedMovieCode(visibleMovies[currentIndex - 1].code);
        return;
      }

      if (!currentMovie) return;

      if (event.key === "Enter") {
        event.preventDefault();
        navigate(`/movies/${encodeURIComponent(currentMovie.code)}`);
        return;
      }

      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        setPreviewCode(currentMovie.code);
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        toggleSelectMovie(currentMovie.code, !selectedMovieCodes.has(currentMovie.code));
        return;
      }

      if (event.key === "Delete") {
        event.preventDefault();
        const targetCodes = selectedMovieCodes.size > 0 ? Array.from(selectedMovieCodes) : [currentMovie.code];
        requestDeleteMovies(targetCodes);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (previewCode) {
          setPreviewCode(null);
          return;
        }
        if (selectedMovieCodes.size > 0) {
          setSelectedMovieCodes(new Set());
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusedMovieCode, navigate, previewCode, selectedMovieCodes, visibleMovies]);

  useEffect(() => {
    const main = document.getElementById("app-main");
    if (!main) return;

    const saved = sessionStorage.getItem(MOVIE_LIST_SCROLL_KEY);
    if (saved) {
      requestAnimationFrame(() => {
        main.scrollTo({ top: Number(saved) || 0 });
      });
    }

    const handleScroll = () => {
      sessionStorage.setItem(MOVIE_LIST_SCROLL_KEY, String(main.scrollTop));
    };

    main.addEventListener("scroll", handleScroll);
    return () => {
      handleScroll();
      main.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    setSelectedMovieCodes((previous) => {
      const availableCodes = new Set(visibleMovies.map((movie) => movie.code));
      const next = new Set(Array.from(previous).filter((movieCode) => availableCodes.has(movieCode)));
      return areSetsEqual(previous, next) ? previous : next;
    });

    if (previewCode && !visibleMovies.some((movie) => movie.code === previewCode)) {
      setPreviewCode(null);
    }

    if (focusedMovieCode && !visibleMovies.some((movie) => movie.code === focusedMovieCode)) {
      setFocusedMovieCode(visibleMovies[0]?.code ?? null);
      return;
    }

    if (!focusedMovieCode && visibleMovies.length > 0) {
      setFocusedMovieCode(visibleMovies[0].code);
    }
  }, [focusedMovieCode, previewCode, visibleMovies]);

  function areSetsEqual<T>(left: Set<T>, right: Set<T>) {
    if (left.size !== right.size) return false;
    for (const value of left) {
      if (!right.has(value)) return false;
    }
    return true;
  }

  const toggleSelectMovie = (movieCode: string, checked: boolean) => {
    setSelectedMovieCodes((previous) => {
      const next = new Set(previous);
      if (checked) next.add(movieCode);
      else next.delete(movieCode);
      return next;
    });
  };

  const toggleSelectAllCurrentPage = (checked: boolean) => {
    if (checked) {
      setSelectedMovieCodes(new Set(visibleMovies.map((movie) => movie.code)));
      return;
    }
    setSelectedMovieCodes(new Set());
  };

  const cancelQueuedDelete = (key: string, codes: string[]) => {
    const timeoutId = deleteTimersRef.current.get(key);
    if (timeoutId != null) window.clearTimeout(timeoutId);
    deleteTimersRef.current.delete(key);
    pendingDeleteQueuesRef.current.delete(key);
    setPendingDeleteCodes((previous) => {
      const next = new Set(previous);
      codes.forEach((code) => next.delete(code));
      return next;
    });
    toast.success(codes.length === 1 ? `已撤销删除 ${codes[0]}` : `已撤销 ${codes.length} 部影片的删除`);
  };

  const cancelAllQueuedDeletes = () => {
    const queuedEntries = Array.from(pendingDeleteQueuesRef.current.entries());
    if (queuedEntries.length === 0) return;

    const pendingCodes = new Set<string>();
    queuedEntries.forEach(([key, codes]) => {
      const timeoutId = deleteTimersRef.current.get(key);
      if (timeoutId != null) window.clearTimeout(timeoutId);
      deleteTimersRef.current.delete(key);
      codes.forEach((code) => pendingCodes.add(code));
    });

    pendingDeleteQueuesRef.current.clear();
    setPendingDeleteCodes((previous) => {
      const next = new Set(previous);
      pendingCodes.forEach((code) => next.delete(code));
      return next;
    });

    toast.success(pendingCodes.size === 1 ? `已撤销删除 ${Array.from(pendingCodes)[0]}` : `已撤销 ${pendingCodes.size} 部影片的删除`);
  };

  const queueDeleteMovies = (codes: string[]) => {
    const uniqueCodes = Array.from(new Set(codes)).filter((code) => movies.some((movie) => movie.code === code) && !pendingDeleteCodes.has(code));
    if (uniqueCodes.length === 0) return;

    const key = [...uniqueCodes].sort().join("|");
    setPendingDeleteCodes((previous) => {
      const next = new Set(previous);
      uniqueCodes.forEach((code) => next.add(code));
      return next;
    });
    setSelectedMovieCodes((previous) => {
      const next = new Set(previous);
      uniqueCodes.forEach((code) => next.delete(code));
      return next;
    });
    if (previewCode && uniqueCodes.includes(previewCode)) setPreviewCode(null);

    const timeoutId = window.setTimeout(async () => {
      deleteTimersRef.current.delete(key);
      try {
        await Promise.all(uniqueCodes.map((movieCode) => deleteMovie(movieCode)));
        setPendingDeleteCodes((previous) => {
          const next = new Set(previous);
          uniqueCodes.forEach((code) => next.delete(code));
          return next;
        });
        await queryClient.invalidateQueries({ queryKey: ["movies"] });
        toast.success(uniqueCodes.length === 1 ? `已删除 ${uniqueCodes[0]}` : `已删除 ${uniqueCodes.length} 部影片`);
      } catch (error) {
        setPendingDeleteCodes((previous) => {
          const next = new Set(previous);
          uniqueCodes.forEach((code) => next.delete(code));
          return next;
        });
        toast.error(`删除失败: ${error}`);
      }
    }, 5000);

    deleteTimersRef.current.set(key, timeoutId);
    pendingDeleteQueuesRef.current.set(key, uniqueCodes);
    toast(uniqueCodes.length === 1 ? `影片 ${uniqueCodes[0]} 已加入删除队列` : `${uniqueCodes.length} 部影片已加入删除队列`, {
      description: "5 秒内可撤销，超时后会真正删除。",
      action: {
        label: "撤销",
        onClick: () => cancelQueuedDelete(key, uniqueCodes),
      },
    });
  };

  const requestDeleteMovies = (codes: string[]) => {
    const uniqueCodes = Array.from(new Set(codes)).filter((code) => movies.some((movie) => movie.code === code) && !pendingDeleteCodes.has(code));
    if (uniqueCodes.length === 0) return;
    setDeleteConfirmCodes(uniqueCodes);
  };

  return (
    <div className="flex h-full -m-6">
      <MovieFilterSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border bg-card/50 px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">当前列表</h2>
                {total > 0 && <Badge variant="secondary">共 {total} 部</Badge>}
                <Badge variant="outline">当前页 {visibleMovies.length}</Badge>
                {activeFilters.length > 0 && <Badge variant="outline">筛选 {activeFilters.length}</Badge>}
                {selectedMovieCodes.size > 0 && <Badge variant="outline">已选 {selectedMovieCodes.size}</Badge>}
              </div>
            </div>
            {isFetching && !isLoading && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <div ref={sortMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSortMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors hover:border-primary/30 hover:bg-accent/40"
                  aria-haspopup="menu"
                  aria-expanded={sortMenuOpen}
                >
                  <span className="text-muted-foreground">排序</span>
                  <span className="font-medium text-foreground">{activeSortOption.label}</span>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", sortMenuOpen && "rotate-180")} />
                </button>

                {sortMenuOpen ? (
                  <div className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-2xl border border-border/80 bg-popover shadow-2xl">
                    <div className="p-2">
                      {SORT_OPTIONS.map((option) => {
                        const active = option.value === sortValue;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              const [nextSortBy, nextSortDir] = option.value.split(":");
                              setSort(nextSortBy, nextSortDir);
                              setSortMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                              active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                            )}
                            aria-pressed={active}
                          >
                            <span>{option.label}</span>
                            <Check className={cn("size-4", active ? "opacity-100" : "opacity-0")} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn("p-2", viewMode === "grid" ? "bg-accent" : "hover:bg-accent/50")}
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  title="表格视图"
                  aria-label="表格视图"
                  className={cn("p-2", viewMode === "table" ? "bg-accent" : "hover:bg-accent/50")}
                >
                  <Table2 className="size-4" />
                </button>
              </div>

              <Button size="sm" variant="outline" onClick={() => setScraperOpen(true)}>
                <Globe className="size-4" />
                刮削
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                添加
              </Button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-auto p-4">
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border/70 bg-card/45 px-4 py-3 text-xs text-muted-foreground shadow-sm">
              <div className="inline-flex items-center gap-2 text-foreground/90">
                <Keyboard className="size-3.5 text-muted-foreground" />
                <span className="font-medium">快捷键</span>
              </div>
              <span className="hidden h-4 w-px bg-border/80 md:block" aria-hidden="true" />
              {SHORTCUT_HINTS.map((hint) => (
                <span key={hint} className="inline-flex items-center rounded-full border border-border/70 bg-background/50 px-2.5 py-1 leading-none">
                  {hint}
                </span>
              ))}
            </div>

            {selectedMovieCodes.size > 0 && (
              <div className="sticky top-4 z-10 mb-4 rounded-2xl border border-primary/30 bg-primary/8 p-4 shadow-lg backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">已进入批量操作模式</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedMovieCodes(new Set())}>
                    清空选择
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => bulkWatchMutation.mutate("watched")} disabled={bulkWatchMutation.isPending}>
                  批量标记已观看
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkWatchMutation.mutate("unwatched")} disabled={bulkWatchMutation.isPending}>
                  批量标记未观看
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    requestDeleteMovies(Array.from(selectedMovieCodes));
                  }}
                  disabled={bulkWatchMutation.isPending}
                >
                  批量删除
                </Button>
                  <Badge variant="secondary" className="rounded-full px-2.5 py-1">Space 继续增减选择</Badge>
                </div>
              </div>
            )}

            {pendingDeleteCodes.size > 0 && (
              <button
                type="button"
                onClick={cancelAllQueuedDeletes}
                className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-100 transition-colors hover:bg-amber-500/15"
              >
                <span>有 {pendingDeleteCodes.size} 部影片等待删除，点击这里可以立即撤销。</span>
                <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-xs text-amber-50">撤销</span>
              </button>
            )}

            {activeFilters.length > 0 && (
              <section className="mb-4 rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium">当前筛选上下文</div>
                  {activeFilters.length > 1 && (
                    <button
                      type="button"
                      onClick={resetFilter}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      清空全部
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeFilters.map((filter) => (
                    <div
                      key={filter.key}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                    >
                      <span>{filter.label}</span>
                      <button
                        type="button"
                        onClick={filter.onKeepOnly}
                        className="rounded-full px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="仅保留这个筛选"
                      >
                        仅保留
                      </button>
                      <button
                        type="button"
                        onClick={filter.onRemove}
                        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="移除这个筛选"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {viewMode === "grid" ? (
              <MovieGrid
                movies={visibleMovies}
                isLoading={isLoading}
                onDeleteMovie={(movieCode) => requestDeleteMovies([movieCode])}
                onOpenPreview={(movieCode) => {
                  setFocusedMovieCode(movieCode);
                  setPreviewCode(movieCode);
                }}
                selectedMovieCodes={selectedMovieCodes}
                focusedMovieCode={focusedMovieCode}
                onToggleSelect={toggleSelectMovie}
                emptyTitle={hasActiveFilters ? "没有匹配的影片" : "还没有影片"}
                emptyDescription={hasActiveFilters ? "试试清除部分筛选条件，或调整搜索关键词。" : "可以先手动添加影片，或者直接使用刮削导入。"}
              />
            ) : (
              <MovieTable
                movies={visibleMovies}
                isLoading={isLoading}
                onDeleteMovie={(movieCode) => requestDeleteMovies([movieCode])}
                onOpenPreview={(movieCode) => {
                  setFocusedMovieCode(movieCode);
                  setPreviewCode(movieCode);
                }}
                selectedMovieCodes={selectedMovieCodes}
                focusedMovieCode={focusedMovieCode}
                onToggleSelect={toggleSelectMovie}
                onToggleSelectAll={toggleSelectAllCurrentPage}
                emptyTitle={hasActiveFilters ? "没有匹配的影片" : "还没有影片"}
                emptyDescription={hasActiveFilters ? "试试清除部分筛选条件，或调整搜索关键词。" : "可以先手动添加影片，或者直接使用刮削导入。"}
              />
            )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2 pb-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </Button>
              <span className="px-3 text-sm text-muted-foreground">
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

          {previewCode && <MovieQuickPreviewPanel code={previewCode} onClose={() => setPreviewCode(null)} />}
        </div>
      </div>

      {deleteConfirmCodes ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteConfirmCodes(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-border/80 bg-card/95 p-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">确认删除</h3>
              <p className="text-sm text-muted-foreground">
                {deleteConfirmCodes.length === 1
                  ? `确定删除影片 “${deleteConfirmCodes[0]}” 吗？`
                  : `确定删除所选的 ${deleteConfirmCodes.length} 部影片吗？`}
              </p>
              <p className="text-xs text-muted-foreground">确认后会进入 5 秒删除队列，仍然可以撤销。</p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteConfirmCodes(null)}>
                取消
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  queueDeleteMovies(deleteConfirmCodes);
                  setDeleteConfirmCodes(null);
                }}
              >
                确认删除
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {scraperOpen && <ScraperDialog onClose={() => setScraperOpen(false)} />}
      {addOpen && <AddMovieDialog onClose={() => setAddOpen(false)} />}
    </div>
  );
}
