import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, FolderOpen, Plus, Search, Star, User, X } from "lucide-react";
import { SearchSuggestionList } from "@/components/search/SearchSuggestionList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { addActorsToCategory, createActor, getActorCategories, getActors, removeActorsFromCategory } from "@/services/actorService";
import { useDebounce } from "@/hooks/useDebounce";
import { useActorSuggestions } from "@/hooks/useSearchSuggestions";
import { assetUrl } from "@/lib/assetUrl";
import { toast } from "sonner";

const PAGE_SIZE = 24;

export function ActorListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState(1);
  const [newName, setNewName] = useState("");
  const [selectedActorIds, setSelectedActorIds] = useState<Set<number>>(new Set());
  const [bulkCategoryMenuOpen, setBulkCategoryMenuOpen] = useState(false);
  const [bulkRemoveCategoryMenuOpen, setBulkRemoveCategoryMenuOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const { data: actorSuggestions = [], isFetching: isActorSuggestionsFetching } = useActorSuggestions(search, true, 6);
  const categoryParam = searchParams.get("category");
  const activeCategoryId = categoryParam && !Number.isNaN(Number(categoryParam)) ? Number(categoryParam) : undefined;

  const { data: categories = [] } = useQuery({
    queryKey: ["actorCategories"],
    queryFn: getActorCategories,
  });
  const activeCategory = categories.find((category) => category.id === activeCategoryId);

  const { data, isLoading } = useQuery({
    queryKey: ["actors", debouncedSearch, page, activeCategoryId],
    queryFn: () => getActors({ search: debouncedSearch || undefined, categoryId: activeCategoryId, page, pageSize: PAGE_SIZE }),
  });

  const createMutation = useMutation({
    mutationFn: createActor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actors"] });
      setNewName("");
    },
    onError: (e) => toast.error(`创建演员失败: ${e}`),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: (categoryId: number) => addActorsToCategory(Array.from(selectedActorIds), categoryId),
    onSuccess: async (_data, categoryId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["actors"] }),
        queryClient.invalidateQueries({ queryKey: ["actorAssignedCategories"] }),
      ]);
      const assignedCategory = categories.find((category) => category.id === categoryId);
      toast.success(`已为 ${selectedActorIds.size} 位演员添加${assignedCategory ? `“${assignedCategory.name}”` : "类型"}`);
      setSelectedActorIds(new Set());
      setBulkCategoryMenuOpen(false);
    },
    onError: (error) => toast.error(`批量添加类型失败: ${error}`),
  });

  const bulkRemoveMutation = useMutation({
    mutationFn: (categoryId: number) => removeActorsFromCategory(Array.from(selectedActorIds), categoryId),
    onSuccess: async (_data, categoryId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["actors"] }),
        queryClient.invalidateQueries({ queryKey: ["actorAssignedCategories"] }),
      ]);
      const removedCategory = categories.find((category) => category.id === categoryId);
      toast.success(`已为 ${selectedActorIds.size} 位演员移除${removedCategory ? `“${removedCategory.name}”` : "类型"}`);
      setSelectedActorIds(new Set());
      setBulkRemoveCategoryMenuOpen(false);
    },
    onError: (error) => toast.error(`批量移除类型失败: ${error}`),
  });

  useEffect(() => {
    const availableIds = new Set((data?.items ?? []).map((actor) => actor.id));
    setSelectedActorIds((previous) => {
      const next = new Set(Array.from(previous).filter((actorId) => availableIds.has(actorId)));
      if (next.size === previous.size && Array.from(next).every((actorId) => previous.has(actorId))) {
        return previous;
      }
      return next;
    });
  }, [data?.items]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const allVisibleSelected = (data?.items.length ?? 0) > 0 && (data?.items ?? []).every((actor) => selectedActorIds.has(actor.id));

  const toggleActorSelection = (actorId: number, checked: boolean) => {
    setSelectedActorIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(actorId);
      else next.delete(actorId);
      return next;
    });
  };

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">演员列表</h1>
          {activeCategory ? <Badge variant="outline">类型: {activeCategory.name}</Badge> : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/actor-categories")}>
            <FolderOpen className="size-4" /> 类型
          </Button>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="搜索演员..."
              value={search}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 100)}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 w-56"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="size-3 text-muted-foreground" />
              </button>
            )}
            <SearchSuggestionList
              open={searchFocused && search.trim().length > 0}
              loading={isActorSuggestionsFetching}
              items={actorSuggestions.map((actor) => ({
                key: String(actor.id),
                title: actor.name,
                subtitle: actor.matched_name !== actor.name ? `匹配: ${actor.matched_name}` : actor.name_jp || "演员详情",
                badge: actor.match_kind.startsWith("alias_") ? "别名" : actor.match_kind.startsWith("name_jp") ? "日文名" : "姓名",
                onSelect: () => {
                  navigate(`/actors/${actor.id}`);
                },
              }))}
              className="w-80"
            />
          </div>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-card/45 px-4 py-3">
          <Badge
            variant={activeCategoryId == null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => {
              setPage(1);
              setSearchParams({});
            }}
          >
            全部
          </Badge>
          {categories.map((category) => (
            <Badge
              key={category.id}
              variant={activeCategoryId === category.id ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => {
                setPage(1);
                setSearchParams({ category: String(category.id) });
              }}
            >
              {category.name}
            </Badge>
          ))}
        </div>
      )}

      {selectedActorIds.size > 0 && (
        <div className="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/8 px-4 py-3 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium">已选择 {selectedActorIds.size} 位演员</div>
            <Badge variant="secondary">批量整理</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (data?.items) {
                  setSelectedActorIds(new Set(data.items.map((actor) => actor.id)));
                }
              }}
            >
              全选当前页
            </Button>
            <div className="min-w-48">
              <InlineOptionMenu
                open={bulkCategoryMenuOpen}
                onOpenChange={setBulkCategoryMenuOpen}
                disabled={bulkAssignMutation.isPending || categories.length === 0}
                triggerLabel={categories.length > 0 ? "批量添加类型" : "没有可用类型"}
                emptyLabel="没有可用类型"
                options={categories.map((category) => ({ id: category.id, label: category.name }))}
                onSelect={(categoryId) => {
                  bulkAssignMutation.mutate(categoryId);
                }}
              />
            </div>
            <div className="min-w-48">
              <InlineOptionMenu
                open={bulkRemoveCategoryMenuOpen}
                onOpenChange={setBulkRemoveCategoryMenuOpen}
                disabled={bulkRemoveMutation.isPending || categories.length === 0}
                triggerLabel={categories.length > 0 ? "批量移除类型" : "没有可用类型"}
                emptyLabel="没有可用类型"
                options={categories.map((category) => ({ id: category.id, label: category.name }))}
                onSelect={(categoryId) => {
                  bulkRemoveMutation.mutate(categoryId);
                }}
              />
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedActorIds(new Set())}>
              清空选择
            </Button>
          </div>
        </div>
      )}

      {/* Create new */}
      <div className="flex gap-2">
        <Input
          placeholder="输入演员姓名..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="max-w-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              createMutation.mutate(newName.trim());
            }
          }}
        />
        <Button size="sm" variant="secondary" onClick={() => { if (!newName.trim()) { toast.error("请输入演员姓名"); return; } createMutation.mutate(newName.trim()); }}>
          <Plus className="size-4" /> 添加
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-muted rounded-xl aspect-[3/4]" />
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {data.items.map((actor) => (
            <div
              key={actor.id}
              onClick={() => navigate(`/actors/${actor.id}`)}
              className={[
                "group relative cursor-pointer overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/50",
                selectedActorIds.has(actor.id) ? "border-primary ring-1 ring-primary/40" : "border-border",
              ].join(" ")}
            >
              <label className="absolute left-2 top-2 z-10 flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white shadow">
                <input
                  type="checkbox"
                  checked={selectedActorIds.has(actor.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => toggleActorSelection(actor.id, event.target.checked)}
                  className="size-3.5"
                  aria-label={`选择演员 ${actor.name}`}
                />
              </label>
              <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                {actor.avatar_path ? (
                  <img src={assetUrl(actor.avatar_path)} alt={actor.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="size-12 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors" />
                )}
              </div>
              <div className="p-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-medium">{actor.name}</div>
                  {selectedActorIds.has(actor.id) ? <Check className="size-3.5 text-primary" /> : null}
                </div>
                {actor.rating != null && (
                  <div className="flex items-center gap-0.5 text-yellow-400">
                    <Star className="size-3 fill-yellow-400" />
                    <span className="text-xs">{actor.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <User className="size-12 text-muted-foreground/30" />
          <p>暂无演员</p>
        </div>
      )}

      {data && data.items.length > 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(event) => {
                if (!data?.items) return;
                setSelectedActorIds(event.target.checked ? new Set(data.items.map((actor) => actor.id)) : new Set());
              }}
            />
            <span>全选当前页</span>
          </label>
        </div>
      ) : null}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}

interface InlineOptionMenuOption {
  id: number;
  label: string;
  secondaryLabel?: string;
}

function InlineOptionMenu({
  open,
  onOpenChange,
  triggerLabel,
  emptyLabel,
  options,
  disabled,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: string;
  emptyLabel: string;
  options: InlineOptionMenuOption[];
  disabled?: boolean;
  onSelect: (id: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !containerRef.current?.contains(target)) {
        onOpenChange(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between rounded-2xl border border-input/80 bg-background/50 px-3 text-sm text-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
        onClick={() => onOpenChange(!open)}
        disabled={disabled}
      >
        <span>{triggerLabel}</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur">
          {options.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60"
                  onClick={() => {
                    onSelect(option.id);
                    onOpenChange(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.secondaryLabel ? <span className="block truncate text-xs text-muted-foreground">{option.secondaryLabel}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
