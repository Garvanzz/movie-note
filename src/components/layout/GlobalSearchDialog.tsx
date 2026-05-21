import { useEffect, useMemo, useState } from "react";
import { Clapperboard, FolderTree, Search, Tag, User, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useActorSuggestions, useMovieSuggestions } from "@/hooks/useSearchSuggestions";
import { useMovieFilterNavigation } from "@/hooks/useMovieFilterNavigation";
import { useMovieFilterOptions } from "@/hooks/useMovies";
import { useRecentVisitsStore } from "@/stores/recentVisitsStore";
import { describeActorMatch } from "@/lib/utils";

interface GlobalSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearchDialog({ open, onClose }: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const openMoviesWithFilter = useMovieFilterNavigation();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim();
  const { data: filterOptions } = useMovieFilterOptions();
  const recentVisits = useRecentVisitsStore((state) => state.items);
  const clearVisits = useRecentVisitsStore((state) => state.clearVisits);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const { data: movieSuggestions, isFetching: isMoviesFetching } = useMovieSuggestions(normalizedQuery, open, 5);
  const { data: actorSuggestions, isFetching: isActorsFetching } = useActorSuggestions(normalizedQuery, open, 5);

  const matchedTags = useMemo(
    () => filterCollection(filterOptions?.tags ?? [], normalizedQuery),
    [filterOptions?.tags, normalizedQuery],
  );
  const matchedGenres = useMemo(
    () => filterCollection(filterOptions?.genres ?? [], normalizedQuery),
    [filterOptions?.genres, normalizedQuery],
  );
  const matchedSeries = useMemo(
    () => filterCollection(filterOptions?.series ?? [], normalizedQuery),
    [filterOptions?.series, normalizedQuery],
  );

  if (!open) return null;

  const isQuerying = isMoviesFetching || isActorsFetching;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-16"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border/80 px-5 py-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索影片、演员、标签、类型、系列..."
            className="h-11 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {!normalizedQuery ? (
            <div className="rounded-xl border border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">全局搜索</p>
              <p className="mt-2">输入后可直接跳到影片、演员详情，或一键按标签、类型、系列筛选影片。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">Ctrl+K</Badge>
                <Badge variant="outline">影片</Badge>
                <Badge variant="outline">演员</Badge>
                <Badge variant="outline">标签 / 类型 / 系列</Badge>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">最近访问</p>
                  {recentVisits.length > 0 && (
                    <button
                      type="button"
                      onClick={clearVisits}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      清空
                    </button>
                  )}
                </div>
                {recentVisits.length > 0 ? recentVisits.map((visit) => (
                  <SearchResultButton
                    key={visit.key}
                    title={visit.title}
                    subtitle={visit.subtitle}
                    meta={visit.type === "filter" ? "筛选" : visit.type === "movie" ? "影片" : "演员"}
                    onClick={() => {
                      if (visit.filter) {
                        openMoviesWithFilter(visit.filter, { title: visit.title, subtitle: visit.subtitle });
                      } else if (visit.href) {
                        navigate(visit.href);
                      }
                      onClose();
                    }}
                  />
                )) : (
                  <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">还没有最近访问记录</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <SearchSection title="影片" icon={Clapperboard}>
                {movieSuggestions?.length ? movieSuggestions.map((movie) => (
                  <SearchResultButton
                    key={movie.code}
                    title={movie.code}
                    subtitle={movie.title || "未命名影片"}
                    meta={movie.release_date || describeMovieMatch(movie.match_kind)}
                    onClick={() => {
                      navigate(`/movies/${encodeURIComponent(movie.code)}`);
                      onClose();
                    }}
                  />
                )) : <EmptySearchResult isLoading={isQuerying} label="没有匹配的影片" />}
              </SearchSection>

              <SearchSection title="演员" icon={User}>
                {actorSuggestions?.length ? actorSuggestions.map((actor) => (
                  <SearchResultButton
                    key={actor.id}
                    title={actor.name}
                    subtitle={actor.matched_name !== actor.name ? `匹配: ${actor.matched_name}` : actor.name_jp || "演员详情"}
                    meta={describeActorMatch(actor.match_kind)}
                    onClick={() => {
                      navigate(`/actors/${actor.id}`);
                      onClose();
                    }}
                  />
                )) : <EmptySearchResult isLoading={isQuerying} label="没有匹配的演员" />}
              </SearchSection>

              <SearchSection title="标签" icon={Tag}>
                {matchedTags.length ? matchedTags.map((tag) => (
                  <SearchResultButton
                    key={`tag-${tag.value}`}
                    title={tag.label}
                    meta={`${tag.count} 部影片`}
                    onClick={() => {
                      openMoviesWithFilter({ tag_ids: [Number(tag.value)] });
                      onClose();
                    }}
                  />
                )) : <EmptySearchResult isLoading={false} label="没有匹配的标签" />}
              </SearchSection>

              <SearchSection title="类型 / 系列" icon={FolderTree}>
                {matchedGenres.length || matchedSeries.length ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {matchedGenres.map((genre) => (
                      <SearchResultButton
                        key={`genre-${genre.value}`}
                        title={genre.label}
                        subtitle="类型"
                        meta={`${genre.count} 部影片`}
                        onClick={() => {
                          openMoviesWithFilter({ genre_ids: [Number(genre.value)] });
                          onClose();
                        }}
                      />
                    ))}
                    {matchedSeries.map((series) => (
                      <SearchResultButton
                        key={`series-${series.value}`}
                        title={series.label}
                        subtitle="系列"
                        meta={`${series.count} 部影片`}
                        onClick={() => {
                          openMoviesWithFilter({ series: series.value });
                          onClose();
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptySearchResult isLoading={false} label="没有匹配的类型或系列" />
                )}
              </SearchSection>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function filterCollection<T extends { label: string }>(items: T[], keyword: string) {
  if (!keyword) return [];
  const normalizedKeyword = keyword.toLowerCase();
  return items.filter((item) => item.label.toLowerCase().includes(normalizedKeyword)).slice(0, 5);
}

function SearchSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Search;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" />
        <span>{title}</span>
      </div>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function SearchResultButton({
  title,
  subtitle,
  meta,
  onClick,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/40 px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
    </button>
  );
}

function EmptySearchResult({ isLoading, label }: { isLoading: boolean; label: string }) {
  return <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">{isLoading ? "搜索中..." : label}</p>;
}

function describeMovieMatch(matchKind: string) {
  if (matchKind.startsWith("code_")) return "番号匹配";
  if (matchKind.startsWith("title_")) return "标题匹配";
  return "影片匹配";
}