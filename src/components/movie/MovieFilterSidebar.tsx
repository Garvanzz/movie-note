import { useState } from "react";
import { Search, Filter, X, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMovieFilterStore } from "@/stores/movieFilterStore";
import { useMovieFilterOptions } from "@/hooks/useMovies";
import { useDebounce } from "@/hooks/useDebounce";

export function MovieFilterSidebar() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const {
    search, tag_ids, series, watch_status, has_files,
    setSearch, toggleTag, resetFilter, setSeries, setWatchStatus, setHasFiles,
  } = useMovieFilterStore();

  // Apply debounced search
  if (debouncedSearch !== (search ?? "")) {
    setSearch(debouncedSearch);
  }

  const { data: filterOptions } = useMovieFilterOptions();
  const tags = filterOptions?.tags ?? [];
  const seriesList = filterOptions?.series ?? [];

  const watchStatuses = [
    { value: "unwatched", label: "未看" },
    { value: "watched", label: "已看" },
    { value: "watching", label: "在看" },
    { value: "paused", label: "暂停" },
  ];

  const activeFilterCount = [
    tag_ids?.length ?? 0,
    series ? 1 : 0,
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
        </div>

        {/* Watch status */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">观看状态</div>
          <div className="flex flex-wrap gap-1">
            {watchStatuses.map((s) => (
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

        {/* Series */}
        {seriesList.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              系列 ({seriesList.length})
            </div>
            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
              {seriesList.slice(0, 30).map((s) => (
                <Badge
                  key={s.value}
                  variant={series === s.value ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => setSeries(series === s.value ? undefined : s.value)}
                >
                  {s.label}
                  <span className="ml-1 text-muted-foreground/70">({s.count})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              标签 ({tags.length})
            </div>
            <div className="flex flex-wrap gap-1 max-h-60 overflow-y-auto">
              {tags.map((t) => (
                <Badge
                  key={t.value}
                  variant={tag_ids?.includes(Number(t.value)) ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => toggleTag(Number(t.value))}
                >
                  {t.label}
                  <span className="ml-1 text-muted-foreground/70">({t.count})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
