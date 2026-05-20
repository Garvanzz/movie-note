import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Filter, RotateCcw, Search, X } from "lucide-react";
import { SearchSuggestionList } from "@/components/search/SearchSuggestionList";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMovieFilterStore } from "@/stores/movieFilterStore";
import { useMovieFilterOptions } from "@/hooks/useMovies";
import { useMovieSuggestions } from "@/hooks/useSearchSuggestions";
import { useDebounce } from "@/hooks/useDebounce";
import { MOVIE_WATCH_STATUS_OPTIONS } from "@/lib/movieWatchStatus";
import { getTagGroupItems, getTagGroups } from "@/services/tagService";
import type { FilterOption } from "@/types/common";

const VISIBLE_OPTION_LIMIT = 15;

export function MovieFilterSidebar() {
  const [searchInput, setSearchInput] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [seriesFilter, setSeriesFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [showAllSeries, setShowAllSeries] = useState(false);
  const [showAllActors, setShowAllActors] = useState(false);
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [expandedTagGroups, setExpandedTagGroups] = useState<Record<string, boolean>>({});
  const [showAllTagGroups, setShowAllTagGroups] = useState<Record<string, boolean>>({});
  const debouncedSearch = useDebounce(searchInput, 300);
  const {
    search, tag_ids, actor_ids, genre_ids, series, rating_min, rating_max, watch_status, has_files,
    setSearch, toggleTag, toggleActor, toggleGenre, resetFilter, setSeries, setRatingRange, setWatchStatus, setHasFiles,
  } = useMovieFilterStore();

  useEffect(() => {
    setSearchInput(search ?? "");
  }, [search]);

  useEffect(() => {
    if (debouncedSearch !== (search ?? "")) {
      setSearch(debouncedSearch);
    }
  }, [debouncedSearch, search, setSearch]);

  const { data: movieSuggestions = [], isFetching: isMovieSuggestionsFetching } = useMovieSuggestions(searchInput, true, 6);

  const { data: filterOptions } = useMovieFilterOptions();
  const tags = filterOptions?.tags ?? [];
  const seriesList = filterOptions?.series ?? [];
  const actors = filterOptions?.actors ?? [];
  const genres = filterOptions?.genres ?? [];
  const ratingPresets = [4.5, 4.0, 3.0];
  const normalizedSeriesFilter = seriesFilter.trim().toLowerCase();
  const normalizedTagFilter = tagFilter.trim().toLowerCase();
  const normalizedActorFilter = actorFilter.trim().toLowerCase();
  const normalizedGenreFilter = genreFilter.trim().toLowerCase();

  const { data: tagGroups = [] } = useQuery({
    queryKey: ["tagGroups"],
    queryFn: getTagGroups,
    staleTime: 60_000,
  });
  const tagGroupItemsResults = useQueries({
    queries: tagGroups.map((group) => ({
      queryKey: ["tagGroupItems", group.id] as const,
      queryFn: () => getTagGroupItems(group.id),
      staleTime: 60_000,
    })),
  });

  const filteredSeries = useMemo(
    () => sortFilterOptions(filterOptionsBySearch(seriesList, normalizedSeriesFilter)),
    [normalizedSeriesFilter, seriesList],
  );
  const filteredActors = useMemo(
    () => sortFilterOptions(filterOptionsBySearch(actors, normalizedActorFilter)),
    [actors, normalizedActorFilter],
  );
  const filteredGenres = useMemo(
    () => sortFilterOptions(filterOptionsBySearch(genres, normalizedGenreFilter)),
    [genres, normalizedGenreFilter],
  );
  const tagSections = useMemo(() => {
    const tagMap = new Map(tags.map((tag) => [Number(tag.value), tag]));
    const assignedTagIds = new Set<number>();
    const sections = tagGroups
      .map((group, index) => {
        const groupItems = tagGroupItemsResults[index]?.data ?? [];
        const options = groupItems
          .map((item) => {
            const option = tagMap.get(item.id);
            if (!option) return null;
            assignedTagIds.add(item.id);
            return option;
          })
          .filter((option): option is FilterOption => option !== null);
        const filteredOptions = sortFilterOptions(filterOptionsBySearch(options, normalizedTagFilter));

        return {
          key: `group-${group.id}`,
          title: group.name,
          options: filteredOptions,
          selectedCount: filteredOptions.filter((option) => tag_ids?.includes(Number(option.value))).length,
        };
      })
      .filter((section) => section.options.length > 0);

    const ungroupedOptions = tags.filter((tag) => !assignedTagIds.has(Number(tag.value)));
    const filteredUngroupedOptions = sortFilterOptions(filterOptionsBySearch(ungroupedOptions, normalizedTagFilter));
    if (filteredUngroupedOptions.length > 0) {
      sections.push({
        key: "ungrouped",
        title: "其他标签",
        options: filteredUngroupedOptions,
        selectedCount: filteredUngroupedOptions.filter((option) => tag_ids?.includes(Number(option.value))).length,
      });
    }

    return sections;
  }, [normalizedTagFilter, tagGroups, tagGroupItemsResults, tag_ids, tags]);

  const activeFilterCount = [
    search ? 1 : 0,
    tag_ids?.length ?? 0,
    actor_ids?.length ?? 0,
    genre_ids?.length ?? 0,
    series ? 1 : 0,
    rating_min != null || rating_max != null ? 1 : 0,
    watch_status ? 1 : 0,
    has_files != null ? 1 : 0,
  ].reduce((a, b) => (a ?? 0) + (b ?? 0), 0);

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="size-4" />
          筛选
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={resetFilter} title="重置筛选">
          <RotateCcw className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="movie-search"
            placeholder="搜索番号/片名..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => window.setTimeout(() => setSearchFocused(false), 100)}
            className="pl-7"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
          <SearchSuggestionList
            open={searchFocused && searchInput.trim().length > 0}
            loading={isMovieSuggestionsFetching}
            items={movieSuggestions.map((movie) => ({
              key: movie.code,
              title: movie.code,
              subtitle: movie.title || "未命名影片",
              meta: movie.release_date || undefined,
              badge: movie.match_kind.startsWith("title_") ? "标题" : "番号",
              onSelect: () => {
                setSearchInput(movie.code);
                setSearch(movie.code);
                setSearchFocused(false);
              },
            }))}
          />
        </div>

        {/* Watch status */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">观看状态</div>
          <div className="flex flex-wrap gap-1">
            {MOVIE_WATCH_STATUS_OPTIONS.map((s) => (
              <Badge
                key={s.value}
                variant={watch_status === s.value ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setWatchStatus(watch_status === s.value ? undefined : s.value)}
              >
                {s.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Has files toggle */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">文件状态</div>
          <div className="flex flex-wrap gap-1">
            <Badge
              variant={has_files === true ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setHasFiles(has_files === true ? undefined : true)}
            >
              有文件
            </Badge>
            <Badge
              variant={has_files === false ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setHasFiles(has_files === false ? undefined : false)}
            >
              无文件
            </Badge>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">评分</div>
          <div className="flex flex-wrap gap-1">
            {ratingPresets.map((min) => {
              const isActive = rating_min === min && rating_max == null;
              return (
                <Badge
                  key={min}
                  variant={isActive ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setRatingRange(isActive ? undefined : min, undefined)}
                >
                  {min.toFixed(1)}+
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Series */}
        {seriesList.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              系列 ({seriesList.length})
            </div>
            <SectionSearchInput value={seriesFilter} onChange={setSeriesFilter} placeholder="搜索系列..." />
            <div className="flex flex-wrap gap-1">
              {visibleOptions(filteredSeries, showAllSeries).map((s) => (
                <Badge
                  key={s.value}
                  variant={series === s.value ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => {
                    setSeries(series === s.value ? undefined : s.value);
                  }}
                >
                  {s.label}
                  <span className="ml-1 text-muted-foreground/70">({s.count})</span>
                </Badge>
              ))}
            </div>
            <SectionFooterToggle
              total={filteredSeries.length}
              expanded={showAllSeries}
              onToggle={() => setShowAllSeries((prev) => !prev)}
            />
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              标签 ({tags.length})
            </div>
            <SectionSearchInput value={tagFilter} onChange={setTagFilter} placeholder="搜索标签..." />
            <div className="space-y-2">
              {tagSections.length > 0 ? tagSections.map((section) => {
                const isExpanded = expandedTagGroups[section.key] ?? section.selectedCount > 0;
                const groupShowAll = showAllTagGroups[section.key] ?? false;

                return (
                  <div key={section.key} className="rounded-md border border-border/70 bg-background/30">
                    <button
                      type="button"
                      onClick={() => setExpandedTagGroups((prev) => ({ ...prev, [section.key]: !isExpanded }))}
                      className="flex w-full items-center justify-between px-2.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        <span>{section.title}</span>
                      </span>
                      <span>{section.options.length}</span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border/60 px-2.5 py-2">
                        <div className="flex flex-wrap gap-1">
                          {visibleOptions(section.options, groupShowAll).map((tag) => (
                            <Badge
                              key={tag.value}
                              variant={tag_ids?.includes(Number(tag.value)) ? "default" : "outline"}
                              className="cursor-pointer text-[10px]"
                              onClick={() => {
                                toggleTag(Number(tag.value));
                              }}
                            >
                              {tag.label}
                              <span className="ml-1 text-muted-foreground/70">({tag.count})</span>
                            </Badge>
                          ))}
                        </div>
                        <SectionFooterToggle
                          total={section.options.length}
                          expanded={groupShowAll}
                          onToggle={() => setShowAllTagGroups((prev) => ({ ...prev, [section.key]: !groupShowAll }))}
                        />
                      </div>
                    )}
                  </div>
                );
              }) : (
                <p className="text-xs text-muted-foreground">没有匹配的标签</p>
              )}
            </div>
          </div>
        )}

        {/* Actors */}
        {actors.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              演员 ({actors.length})
            </div>
            <SectionSearchInput value={actorFilter} onChange={setActorFilter} placeholder="搜索演员..." />
            <div className="flex flex-wrap gap-1">
              {visibleOptions(filteredActors, showAllActors).map((a) => (
                <Badge
                  key={a.value}
                  variant={actor_ids?.includes(Number(a.value)) ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => {
                    toggleActor(Number(a.value));
                  }}
                >
                  {a.label}
                  <span className="ml-1 text-muted-foreground/70">({a.count})</span>
                </Badge>
              ))}
            </div>
            <SectionFooterToggle
              total={filteredActors.length}
              expanded={showAllActors}
              onToggle={() => setShowAllActors((prev) => !prev)}
            />
          </div>
        )}

        {/* Genres */}
        {genres.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              类型 ({genres.length})
            </div>
            <SectionSearchInput value={genreFilter} onChange={setGenreFilter} placeholder="搜索类型..." />
            <div className="flex flex-wrap gap-1">
              {visibleOptions(filteredGenres, showAllGenres).map((g) => (
                <Badge
                  key={g.value}
                  variant={genre_ids?.includes(Number(g.value)) ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => {
                    toggleGenre(Number(g.value));
                  }}
                >
                  {g.label}
                  <span className="ml-1 text-muted-foreground/70">({g.count})</span>
                </Badge>
              ))}
            </div>
            <SectionFooterToggle
              total={filteredGenres.length}
              expanded={showAllGenres}
              onToggle={() => setShowAllGenres((prev) => !prev)}
            />
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}

function filterOptionsBySearch(options: FilterOption[], keyword: string) {
  if (!keyword) return options;
  return options.filter((option) => option.label.toLowerCase().includes(keyword));
}

function visibleOptions(options: FilterOption[], expanded: boolean) {
  return expanded ? options : options.slice(0, VISIBLE_OPTION_LIMIT);
}

function sortFilterOptions(options: FilterOption[]) {
  return [...options].sort((left, right) => {
    return right.count - left.count || left.label.localeCompare(right.label, "zh-CN");
  });
}

function SectionSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 pl-6 pr-6 text-xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

function SectionFooterToggle({
  total,
  expanded,
  onToggle,
}: {
  total: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (total <= VISIBLE_OPTION_LIMIT) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {expanded ? "收起" : `查看更多 (${total - VISIBLE_OPTION_LIMIT})`}
    </button>
  );
}
