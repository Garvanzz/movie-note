import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Tag as TagIcon, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getTags, createTag, deleteTag, getTagGroups, createTagGroup } from "@/services/tagService";

export function TagManagementPage() {
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  const { data: tags, isLoading: tagsLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: getTags,
  });

  const { data: tagGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ["tagGroups"],
    queryFn: getTagGroups,
  });

  const createTagMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setNewTagName("");
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });

  const createGroupMutation = useMutation({
    mutationFn: createTagGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tagGroups"] });
      setNewGroupName("");
    },
  });

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8">
      <h1 className="text-2xl font-bold">标签管理</h1>

      {/* Tags section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TagIcon className="size-5" />
          <h2 className="text-lg font-medium">标签</h2>
          {tags && <Badge variant="secondary">{tags.length}</Badge>}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="输入标签名..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTagName.trim()) {
                createTagMutation.mutate(newTagName.trim());
              }
            }}
          />
          <Button size="sm" onClick={() => newTagName.trim() && createTagMutation.mutate(newTagName.trim())} disabled={!newTagName.trim()}>
            <Plus className="size-4" /> 添加
          </Button>
        </div>

        {tagsLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-muted rounded-full h-7 w-20" />
            ))}
          </div>
        ) : tags && tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag.id} variant="outline" className="group pr-1 gap-1">
                {tag.name}
                <button
                  onClick={() => { if (confirm(`删除标签 "${tag.name}"?`)) deleteTagMutation.mutate(tag.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无标签</p>
        )}
      </div>

      {/* Tag groups section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-5" />
          <h2 className="text-lg font-medium">标签组</h2>
          {tagGroups && <Badge variant="secondary">{tagGroups.length}</Badge>}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="输入标签组名..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newGroupName.trim()) {
                createGroupMutation.mutate(newGroupName.trim());
              }
            }}
          />
          <Button size="sm" onClick={() => newGroupName.trim() && createGroupMutation.mutate(newGroupName.trim())} disabled={!newGroupName.trim()}>
            <Plus className="size-4" /> 添加
          </Button>
        </div>

        {groupsLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-muted rounded-md h-10" />
          ))}</div>
        ) : tagGroups && tagGroups.length > 0 ? (
          <div className="space-y-2">
            {tagGroups.map((group) => (
              <div key={group.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 text-sm">
                <span>{group.name}</span>
                {group.description && <span className="text-xs text-muted-foreground">{group.description}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无标签组</p>
        )}
      </div>
    </div>
  );
}
