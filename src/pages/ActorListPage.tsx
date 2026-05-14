import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Search, X, Star, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { getActors, createActor } from "@/services/actorService";
import { useDebounce } from "@/hooks/useDebounce";

const PAGE_SIZE = 24;

export function ActorListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [newName, setNewName] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["actors", debouncedSearch, page],
    queryFn: () => getActors({ search: debouncedSearch || undefined, page, pageSize: PAGE_SIZE }),
  });

  const createMutation = useMutation({
    mutationFn: createActor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actors"] });
      setNewName("");
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">演员列表</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="搜索演员..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 w-56"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="size-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

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
        <Button size="sm" onClick={() => newName.trim() && createMutation.mutate(newName.trim())} disabled={!newName.trim()}>
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
              className="group cursor-pointer bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-colors"
            >
              <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                {actor.avatar_path ? (
                  <img src={actor.avatar_path} alt={actor.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="size-12 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors" />
                )}
              </div>
              <div className="p-2.5 space-y-1">
                <div className="font-medium text-sm truncate">{actor.name}</div>
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
