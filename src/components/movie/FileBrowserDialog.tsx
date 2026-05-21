import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  CloudOff,
  Folder,
  FolderOpen,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  listProviderConfigs,
  providerList,
  providerSearch,
} from "@/services/fileService";
import type { ProviderConfigData, ProviderFileEntry } from "@/types/file";

export interface SelectedFileEntry {
  file_path: string;
  file_name: string;
  file_size: number | null;
  provider: string;
  provider_file_id: string;
  provider_url: string | null;
}

interface FileBrowserDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (files: SelectedFileEntry[]) => void;
  /** Pre-fill search query with this movie code */
  code?: string;
}

export function FileBrowserDialog({ open, onClose, onSelect, code }: FileBrowserDialogProps) {
  const { data: configs = [] } = useQuery({
    queryKey: ["providerConfigs"],
    queryFn: listProviderConfigs,
    enabled: open,
  });

  const [providerId, setProviderId] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<ProviderFileEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(code ?? "");

  const activeConfig = configs.find((c) => c.id === providerId) ?? null;

  // Reset on open
  useEffect(() => {
    if (open) {
      setProviderId(null);
      setPath("");
      setEntries([]);
      setSelectedIds(new Set());
      setError(null);
      setSearchQuery(code ?? "");
    }
  }, [open, code]);

  // Load directory contents
  const loadDir = useCallback(
    async (dirPath: string) => {
      if (!activeConfig) return;
      setLoading(true);
      setError(null);
      try {
        const result = await providerList(toProviderConfig(activeConfig), dirPath || "");
        setEntries(result);
        setPath(dirPath);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [activeConfig],
  );

  // Auto-load on provider select
  useEffect(() => {
    if (activeConfig) {
      loadDir("");
    } else {
      setEntries([]);
    }
  }, [providerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProviderSelect = (id: string) => {
    setProviderId(id);
    setSelectedIds(new Set());
  };

  const handleNavigate = (dirPath: string) => {
    loadDir(dirPath);
  };

  const handleSearch = async () => {
    if (!activeConfig || !searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await providerSearch(toProviderConfig(activeConfig), searchQuery.trim());
      setEntries(result);
      setPath(""); // search results have no single path
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (entry: ProviderFileEntry) => {
    if (entry.is_directory) return;
    const next = new Set(selectedIds);
    if (next.has(entry.file_id)) {
      next.delete(entry.file_id);
    } else {
      next.add(entry.file_id);
    }
    setSelectedIds(next);
  };

  const handleConfirm = () => {
    if (!activeConfig) return;
    const selected = entries
      .filter((e) => selectedIds.has(e.file_id))
      .map((e) => ({
        file_path: e.file_id,
        file_name: e.file_name,
        file_size: e.file_size,
        provider: activeConfig.provider_type,
        provider_file_id: e.file_id,
        provider_url: e.file_url,
      }));
    if (selected.length === 0) {
      toast.error("请先选择文件");
      return;
    }
    onSelect(selected);
    onClose();
  };

  const selectedCount = selectedIds.size;
  const breadcrumbs = buildBreadcrumbs(path);
  const dirs = entries.filter((e) => e.is_directory);
  const files = entries.filter((e) => !e.is_directory);
  const sorted = [...dirs, ...files];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border/80 bg-background p-2.5 text-foreground">
              <FolderOpen className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">从网盘选择文件</h2>
              {selectedCount > 0 && (
                <p className="text-xs text-muted-foreground">已选 {selectedCount} 个</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Provider selector */}
        {configs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-muted-foreground">
            <CloudOff className="size-10" />
            <p className="text-sm">尚未配置任何网盘连接</p>
            <p className="text-xs">请先在侧边栏「网盘」中添加 WebDAV 或本地目录连接。</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border/40 px-5 py-3">
              <span className="shrink-0 text-xs text-muted-foreground">连接</span>
              <div className="flex flex-wrap gap-1.5">
                {configs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleProviderSelect(c.id)}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      c.id === providerId
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "border border-border/60 text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {activeConfig && (
              <>
                {/* Search bar */}
                <div className="flex items-center gap-2 border-b border-border/40 px-5 py-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder={code ? `搜索 ${code} 相关文件...` : "搜索文件..."}
                      className="h-9 rounded-xl pl-8 text-xs"
                    />
                  </div>
                  <Button size="sm" variant="secondary" onClick={handleSearch} disabled={loading} className="h-9 rounded-xl text-xs">
                    {loading ? <Loader2 className="size-3 animate-spin" /> : "搜索"}
                  </Button>
                </div>

                {/* Breadcrumb */}
                {path && (
                  <div className="flex items-center gap-1 overflow-x-auto border-b border-border/40 px-5 py-2">
                    <button
                      type="button"
                      onClick={() => handleNavigate("")}
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      根目录
                    </button>
                    {breadcrumbs.map((crumb, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <ChevronRight className="size-3 text-muted-foreground/50" />
                        <button
                          type="button"
                          onClick={() => handleNavigate(crumb.path)}
                          className="truncate rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground max-w-[160px]"
                          title={crumb.name}
                        >
                          {crumb.name}
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* File list */}
                <div className="flex-1 overflow-y-auto px-2 py-2" style={{ maxHeight: "50vh" }}>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : error ? (
                    <div className="px-4 py-8 text-center text-sm text-destructive">{error}</div>
                  ) : sorted.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {searchQuery ? "未找到匹配文件" : "此目录为空"}
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {sorted.map((entry) => (
                        <FileRow
                          key={entry.file_id}
                          entry={entry}
                          selected={selectedIds.has(entry.file_id)}
                          onToggle={() => toggleSelect(entry)}
                          onNavigate={() => handleNavigate(entry.file_id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border/70 px-5 py-4">
              <p className="text-xs text-muted-foreground">
                {activeConfig ? "点击目录进入，点击文件选择" : "请先选择网盘连接"}
              </p>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={selectedCount === 0 || !activeConfig}
                className="rounded-xl"
              >
                <Check className="size-3.5" />
                关联选中 {selectedCount > 0 ? `(${selectedCount})` : ""}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FileRow({
  entry,
  selected,
  onToggle,
  onNavigate,
}: {
  entry: ProviderFileEntry;
  selected: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors cursor-pointer ${
        selected
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-accent/60 border border-transparent"
      }`}
      onClick={() => (entry.is_directory ? onNavigate() : onToggle())}
    >
      {entry.is_directory ? (
        <Folder className="size-4 shrink-0 text-amber-500" />
      ) : (
        <div
          className={`flex size-4 shrink-0 items-center justify-center rounded border ${
            selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
          }`}
        >
          {selected && <Check className="size-3" />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{entry.file_name}</div>
        {entry.file_size != null && !entry.is_directory && (
          <div className="text-xs text-muted-foreground">{formatFileSize(entry.file_size)}</div>
        )}
      </div>
    </div>
  );
}

function buildBreadcrumbs(path: string): { name: string; path: string }[] {
  const segments = path.split("/").filter(Boolean);
  const crumbs: { name: string; path: string }[] = [];
  let cumulative = "";
  for (const seg of segments) {
    cumulative += `/${seg}`;
    crumbs.push({ name: seg, path: cumulative });
  }
  return crumbs;
}

function toProviderConfig(c: ProviderConfigData) {
  return {
    providerName: c.provider_type,
    root: c.root ?? undefined,
    endpoint: c.endpoint ?? undefined,
    username: c.username ?? undefined,
    password: c.password ?? undefined,
  };
}
