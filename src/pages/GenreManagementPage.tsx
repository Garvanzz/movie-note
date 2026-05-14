import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getGenres, createGenre, deleteGenre } from "@/services/tagService";

export function GenreManagementPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");

  const { data: genres, isLoading } = useQuery({
    queryKey: ["genres"],
    queryFn: getGenres,
  });

  const createMutation = useMutation({
    mutationFn: createGenre,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genres"] });
      setNewName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGenre,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["genres"] }),
  });

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2">
        <FolderTree className="size-5" />
        <h1 className="text-2xl font-bold">类型管理</h1>
        {genres && <Badge variant="secondary">{genres.length}</Badge>}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="输入类型名..."
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

      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-muted rounded-full h-7 w-20" />
          ))}
        </div>
      ) : genres && genres.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <Badge key={genre.id} variant="outline" className="group pr-1 gap-1">
              {genre.name}
              <button
                onClick={() => { if (confirm(`删除类型 "${genre.name}"?`)) deleteMutation.mutate(genre.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">暂无类型</p>
      )}
    </div>
  );
}
