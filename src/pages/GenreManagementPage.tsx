import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, FolderTree, ArrowDown, ArrowUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMovieFilterNavigation } from "@/hooks/useMovieFilterNavigation";
import { useMovieFilterOptions } from "@/hooks/useMovies";
import { getGenres, createGenre, deleteGenre } from "@/services/tagService";
import { createActorCategory, deleteActorCategory, getActorCategories, moveActorCategory } from "@/services/actorService";
import { toast } from "sonner";

export function GenreManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openMoviesWithFilter = useMovieFilterNavigation();
  const [newGenreName, setNewGenreName] = useState("");
  const [newActorTypeName, setNewActorTypeName] = useState("");
  const { data: filterOptions } = useMovieFilterOptions();

  const { data: genres, isLoading } = useQuery({
    queryKey: ["genres"],
    queryFn: getGenres,
  });

  const { data: actorTypes = [], isLoading: actorTypesLoading } = useQuery({
    queryKey: ["actorCategories"],
    queryFn: getActorCategories,
  });

  const createMutation = useMutation({
    mutationFn: createGenre,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genres"] });
      setNewGenreName("");
    },
    onError: (e) => toast.error(`创建类型失败: ${e}`),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGenre,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["genres"] }),
    onError: (e) => toast.error(`删除类型失败: ${e}`),
  });

  const createActorTypeMutation = useMutation({
    mutationFn: createActorCategory,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["actorCategories"] }),
        queryClient.invalidateQueries({ queryKey: ["actors"] }),
      ]);
      setNewActorTypeName("");
    },
    onError: (error) => toast.error(`创建演员类型失败: ${error}`),
  });

  const deleteActorTypeMutation = useMutation({
    mutationFn: deleteActorCategory,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["actorCategories"] }),
        queryClient.invalidateQueries({ queryKey: ["actors"] }),
      ]);
    },
    onError: (error) => toast.error(`删除演员类型失败: ${error}`),
  });

  const moveActorTypeMutation = useMutation({
    mutationFn: ({ id, direction }: { id: number; direction: "up" | "down" }) => moveActorCategory(id, direction),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["actorCategories"] }),
    onError: (error) => toast.error(`调整演员类型顺序失败: ${error}`),
  });

  const genreCountMap = new Map((filterOptions?.genres ?? []).map((option) => [Number(option.value), option.count]));

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2">
        <FolderTree className="size-5" />
        <h1 className="text-2xl font-bold">类型管理</h1>
        {genres && <Badge variant="secondary">{genres.length}</Badge>}
      </div>

      <section className="space-y-4 rounded-2xl border border-border/70 bg-card/35 p-5">
        <div className="flex items-center gap-2">
          <FolderTree className="size-4" />
          <h2 className="text-sm font-medium">影片类型</h2>
          {genres ? <Badge variant="secondary">{genres.length}</Badge> : null}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="输入影片类型名..."
            value={newGenreName}
            onChange={(e) => setNewGenreName(e.target.value)}
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newGenreName.trim()) {
                createMutation.mutate(newGenreName.trim());
              }
            }}
          />
          <Button size="sm" variant="secondary" onClick={() => { if (!newGenreName.trim()) { toast.error("请输入影片类型名"); return; } createMutation.mutate(newGenreName.trim()); }}>
            <Plus className="size-4" /> 添加
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-muted rounded-full h-7 w-20" />
            ))}
          </div>
        ) : genres && genres.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => (
              <div key={genre.id} className="group inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent/30">
                <button type="button" onClick={() => openMoviesWithFilter({ genre_ids: [genre.id] })} className="cursor-pointer transition-colors hover:text-primary">
                  {genre.name}
                </button>
                <span className="text-[10px] text-muted-foreground">{genreCountMap.get(genre.id) ?? 0}</span>
                <button
                  type="button"
                  onClick={() => { if (confirm(`删除类型 "${genre.name}"?`)) deleteMutation.mutate(genre.id); }}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无影片类型</p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-border/70 bg-card/35 p-5">
        <div className="flex items-center gap-2">
          <Users className="size-4" />
          <h2 className="text-sm font-medium">演员类型</h2>
          <Badge variant="secondary">{actorTypes.length}</Badge>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="输入演员类型名..."
            value={newActorTypeName}
            onChange={(event) => setNewActorTypeName(event.target.value)}
            className="max-w-xs"
            onKeyDown={(event) => {
              if (event.key === "Enter" && newActorTypeName.trim()) {
                createActorTypeMutation.mutate(newActorTypeName.trim());
              }
            }}
          />
          <Button size="sm" variant="secondary" onClick={() => { if (!newActorTypeName.trim()) { toast.error("请输入演员类型名"); return; } createActorTypeMutation.mutate(newActorTypeName.trim()); }}>
            <Plus className="size-4" /> 添加
          </Button>
        </div>

        {actorTypesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : actorTypes.length > 0 ? (
          <div className="space-y-2">
            {actorTypes.map((actorType, index) => (
              <div key={actorType.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      disabled={index === 0 || moveActorTypeMutation.isPending}
                      onClick={() => moveActorTypeMutation.mutate({ id: actorType.id, direction: "up" })}
                      title="上移"
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      disabled={index === actorTypes.length - 1 || moveActorTypeMutation.isPending}
                      onClick={() => moveActorTypeMutation.mutate({ id: actorType.id, direction: "down" })}
                      title="下移"
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/actors?category=${actorType.id}`)}
                    className="inline-flex min-w-0 items-center gap-2 text-sm font-medium transition-colors hover:text-primary"
                  >
                    <Users className="size-4" />
                    <span className="truncate">{actorType.name}</span>
                  </button>
                </div>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => {
                    if (confirm(`删除演员类型 "${actorType.name}"?`)) {
                      deleteActorTypeMutation.mutate(actorType.id);
                    }
                  }}
                  title="删除演员类型"
                >
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无演员类型</p>
        )}
      </section>
    </div>
  );
}
