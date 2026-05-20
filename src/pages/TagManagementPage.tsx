import { useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FolderOpen, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMovieFilterNavigation } from "@/hooks/useMovieFilterNavigation";
import { useMovieFilterOptions } from "@/hooks/useMovies";
import { addTagToGroup, createTag, createTagGroup, deleteTag, deleteTagGroup, getTagGroupItems, getTagGroups, getTags, removeTagFromGroup } from "@/services/tagService";
import type { Tag } from "@/types/tag";
import { toast } from "sonner";

export function TagManagementPage() {
  const queryClient = useQueryClient();
  const openMoviesWithFilter = useMovieFilterNavigation();
  const [newTagName, setNewTagName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const { data: filterOptions } = useMovieFilterOptions();

  const { data: tags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ["tags", "movie"],
    queryFn: () => getTags("movie"),
  });

  const { data: tagGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ["tagGroups"],
    queryFn: getTagGroups,
  });

  const groupIds = (tagGroups ?? []).map((group) => group.id);
  const groupItemsResults = useQueries({
    queries: groupIds.map((groupId) => ({
      queryKey: ["tagGroupItems", groupId] as const,
      queryFn: () => getTagGroupItems(groupId),
    })),
  });
  const groupItemsQueries: Record<number, { data?: Tag[] }> = {};
  groupIds.forEach((groupId, index) => {
    groupItemsQueries[groupId] = groupItemsResults[index] as { data?: Tag[] };
  });

  const tagGroupMap = new Map<number, { id: number; name: string }>();
  for (const group of tagGroups ?? []) {
    const groupTags = groupItemsQueries[group.id]?.data ?? [];
    for (const tag of groupTags) {
      if (!tagGroupMap.has(tag.id)) {
        tagGroupMap.set(tag.id, { id: group.id, name: group.name });
      }
    }
  }

  const tagCountMap = new Map((filterOptions?.tags ?? []).map((option) => [Number(option.value), option.count]));

  const createTagMutation = useMutation({
    mutationFn: (name: string) => createTag(name, "movie"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setNewTagName("");
    },
    onError: (error) => toast.error(`创建标签失败: ${error}`),
  });

  const deleteTagMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["tagGroupItems"] });
    },
    onError: (error) => toast.error(`删除标签失败: ${error}`),
  });

  const createGroupMutation = useMutation({
    mutationFn: createTagGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tagGroups"] });
      setNewGroupName("");
    },
    onError: (error) => toast.error(`创建标签组失败: ${error}`),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteTagGroup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tagGroups"] }),
    onError: (error) => toast.error(`删除标签组失败: ${error}`),
  });

  const addToGroupMutation = useMutation({
    mutationFn: ({ groupId, tagId }: { groupId: number; tagId: number }) => addTagToGroup(groupId, tagId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tagGroupItems", variables.groupId] });
    },
    onError: (error) => toast.error(`添加标签到组失败: ${error}`),
  });

  const removeFromGroupMutation = useMutation({
    mutationFn: ({ groupId, tagId }: { groupId: number; tagId: number }) => removeTagFromGroup(groupId, tagId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tagGroupItems", variables.groupId] });
    },
    onError: (error) => toast.error(`从组移除标签失败: ${error}`),
  });

  const toggleGroup = (id: number) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-6">
      <h1 className="text-2xl font-bold">标签管理</h1>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-5" />
          <h2 className="text-lg font-medium">标签组</h2>
          {tagGroups ? <Badge variant="secondary">{tagGroups.length}</Badge> : null}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="输入标签组名..."
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            className="max-w-xs"
            onKeyDown={(event) => {
              if (event.key === "Enter" && newGroupName.trim()) {
                createGroupMutation.mutate(newGroupName.trim());
              }
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (!newGroupName.trim()) {
                toast.error("请输入标签组名");
                return;
              }
              createGroupMutation.mutate(newGroupName.trim());
            }}
          >
            <Plus className="size-4" /> 添加
          </Button>
        </div>

        {groupsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : tagGroups && tagGroups.length > 0 ? (
          <div className="space-y-2">
            {tagGroups.map((group) => {
              const groupTags = groupItemsQueries[group.id]?.data ?? [];
              const groupTagIds = new Set(groupTags.map((tag) => tag.id));
              const availableForGroup = tags.filter((tag) => !groupTagIds.has(tag.id));

              return (
                <div key={group.id} className="overflow-hidden rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center justify-between bg-muted/50 px-3 py-2.5">
                    <button onClick={() => toggleGroup(group.id)} className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-foreground">
                      {expandedGroups.has(group.id) ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      {group.name}
                      <Badge variant="secondary" className="text-[10px]">{groupTags.length}</Badge>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`删除标签组 \"${group.name}\"?`)) {
                          deleteGroupMutation.mutate(group.id);
                        }
                      }}
                      className="opacity-0 transition-opacity hover:opacity-100"
                    >
                      <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>

                  {expandedGroups.has(group.id) ? (
                    <div className="space-y-2 px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {groupTags.length > 0 ? (
                          groupTags.map((tag) => (
                            <div key={tag.id} className="group inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent/30">
                              <button type="button" onClick={() => openMoviesWithFilter({ tag_ids: [tag.id] })} className="cursor-pointer transition-colors hover:text-primary">
                                {tag.name}
                              </button>
                              <span className="text-[10px] text-muted-foreground">{tagCountMap.get(tag.id) ?? 0}</span>
                              <button
                                type="button"
                                onClick={() => removeFromGroupMutation.mutate({ groupId: group.id, tagId: tag.id })}
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">暂无标签</p>
                        )}
                      </div>

                      {availableForGroup.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs text-muted-foreground"
                            onChange={(event) => {
                              if (event.target.value) {
                                addToGroupMutation.mutate({ groupId: group.id, tagId: Number(event.target.value) });
                                event.target.value = "";
                              }
                            }}
                          >
                            <option value="">+ 添加标签到组</option>
                            {availableForGroup.map((tag) => (
                              <option key={tag.id} value={tag.id}>{tag.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无标签组</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TagIcon className="size-5" />
          <h2 className="text-lg font-medium">标签</h2>
          <Badge variant="secondary">{tags.length}</Badge>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="输入标签名..."
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            className="max-w-xs"
            onKeyDown={(event) => {
              if (event.key === "Enter" && newTagName.trim()) {
                createTagMutation.mutate(newTagName.trim());
              }
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (!newTagName.trim()) {
                toast.error("请输入标签名");
                return;
              }
              createTagMutation.mutate(newTagName.trim());
            }}
          >
            <Plus className="size-4" /> 添加
          </Button>
        </div>

        {tagsLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-7 w-20 animate-pulse rounded-full bg-muted" />
            ))}
          </div>
        ) : tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const group = tagGroupMap.get(tag.id);
              return (
                <div key={tag.id} className="group inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent/30">
                  <button type="button" onClick={() => openMoviesWithFilter({ tag_ids: [tag.id] })} className="cursor-pointer transition-colors hover:text-primary">
                    {tag.name}
                  </button>
                  <span className="text-[10px] text-muted-foreground">{tagCountMap.get(tag.id) ?? 0}</span>
                  {group ? <Badge variant="secondary" className="h-4 px-1 text-[10px]">{group.name}</Badge> : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`删除标签 \"${tag.name}\"?`)) {
                        deleteTagMutation.mutate(tag.id);
                      }
                    }}
                    className="ml-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无标签</p>
        )}
      </div>
    </div>
  );
}
