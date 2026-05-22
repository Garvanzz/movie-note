import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, X, Download, Globe, Loader2, Check, Film } from "lucide-react";
import { SearchSuggestionList } from "@/components/search/SearchSuggestionList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMovieSuggestions } from "@/hooks/useSearchSuggestions";
import {
  scraperSearch,
  scraperGetDetail,
  scraperImport,
  type ScraperSearchResult,
} from "@/services/scraperService";
import { scraperDownloadImages } from "@/services/scraperService";

interface Props {
  onClose: () => void;
}

export function ScraperDialog({ onClose }: Props) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScraperSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [queryFocused, setQueryFocused] = useState(false);
  const [importingCode, setImportingCode] = useState<string | null>(null);
  const [importedCodes, setImportedCodes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [proxyUrl, setProxyUrl] = useState(() => localStorage.getItem("scraper_proxy") ?? "http://127.0.0.1:7890");
  const { data: movieSuggestions = [], isFetching: isMovieSuggestionsFetching } = useMovieSuggestions(query, true, 6);

  const handleSearch = async (nextQuery?: string) => {
    const normalizedQuery = (nextQuery ?? query).trim();
    if (!normalizedQuery) return;
    setSearching(true);
    setError(null);
    try {
      if (nextQuery) {
        setQuery(normalizedQuery);
      }
      const data = await scraperSearch(normalizedQuery, proxyUrl || undefined);
      setResults(data);
      if (data.length === 0) setError("未找到结果");
    } catch (e) {
      setError(String(e));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleImport = async (result: ScraperSearchResult) => {
    setImportingCode(result.code);
    setError(null);
    try {
      const detail = await scraperGetDetail(result.url, result.source, proxyUrl || undefined);
      await scraperImport(detail);
      await scraperDownloadImages(
        result.code,
        result.cover_url ?? null,
        detail.screenshots ?? [],
        proxyUrl || undefined,
      );
      setImportedCodes((prev) => new Set(prev).add(result.code));
      queryClient.invalidateQueries({ queryKey: ["movies"] });
    } catch (e) {
      setError(`导入失败: ${e}`);
    } finally {
      setImportingCode(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="m-4 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border/80 bg-background p-2.5 text-foreground">
              <Globe className="size-5" />
            </div>
            <h2 className="text-base font-semibold">在线刮削</h2>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Search bar */}
        <div className="border-b border-border/80 px-5 py-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="输入番号搜索，如 IPX-123..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setQueryFocused(true)}
                onBlur={() => window.setTimeout(() => setQueryFocused(false), 100)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="h-11 flex-1 rounded-xl border-border/80 bg-background/70 shadow-none"
                autoFocus
              />
              <SearchSuggestionList
                open={queryFocused && query.trim().length > 0}
                loading={isMovieSuggestionsFetching}
                items={movieSuggestions.map((movie) => ({
                  key: movie.code,
                  title: movie.code,
                  subtitle: movie.title || "使用该番号搜索在线结果",
                  meta: movie.release_date || undefined,
                  badge: movie.match_kind.startsWith("title_") ? "标题" : "番号",
                  onSelect: () => {
                    void handleSearch(movie.code);
                    setQueryFocused(false);
                  },
                }))}
              />
            </div>
            <Button variant="secondary" className="h-11 rounded-xl" onClick={() => void handleSearch()} disabled={searching || !query.trim()}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              搜索
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="代理: http://127.0.0.1:7890 (Clash 默认)"
              value={proxyUrl}
              onChange={(e) => {
                setProxyUrl(e.target.value);
                localStorage.setItem("scraper_proxy", e.target.value);
              }}
              className="h-8 flex-1 rounded-xl border-border/60 bg-background/50 text-xs font-mono shadow-none"
            />
          </div>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {results.length === 0 && !searching && (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground text-sm">
              <Film className="size-10 text-muted-foreground/30" />
              <p>搜索 javdb / javbus 在线数据库</p>
              <p className="text-xs">支持标准番号、FC2、SIRO 等格式</p>
            </div>
          )}

          {results.map((r) => {
            const isImported = importedCodes.has(r.code);
            const isImporting = importingCode === r.code;
            return (
              <div
                key={`${r.source}:${r.code}`}
                className="flex gap-3 p-3 bg-muted/40 rounded-lg border border-border hover:border-primary/30 transition-colors"
              >
                <div className="w-16 shrink-0 aspect-[3/4] bg-muted rounded overflow-hidden flex items-center justify-center">
                  <Film className="size-6 text-muted-foreground/30" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-sm text-primary">{r.code}</span>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">{r.source}</Badge>
                  </div>
                  {r.title && <p className="text-sm truncate">{r.title}</p>}
                  {r.actors.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.actors.slice(0, 5).map((a) => (
                        <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>
                      ))}
                    </div>
                  )}
                  {r.release_date && <p className="text-xs text-muted-foreground">{r.release_date}</p>}
                </div>
                <div className="shrink-0 flex items-center">
                  {isImported ? (
                    <Check className="size-5 text-green-400" />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleImport(r)}
                      disabled={isImporting}
                    >
                      {isImporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                      导入
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
