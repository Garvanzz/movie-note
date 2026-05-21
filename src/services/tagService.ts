import { invoke } from "./invoke";
import type { Genre, Tag, TagGroup, TagScope } from "@/types/tag";

export function getTags(scope?: TagScope): Promise<Tag[]> {
  return invoke("get_tags", { scope: scope ?? null });
}

export function createTag(name: string, scope: TagScope): Promise<Tag> {
  return invoke("create_tag", { name, scope });
}

export function deleteTag(id: number): Promise<void> {
  return invoke("delete_tag", { id });
}

export function getTagGroups(): Promise<TagGroup[]> {
  return invoke("get_tag_groups");
}

export function createTagGroup(name: string): Promise<TagGroup> {
  return invoke("create_tag_group", { name });
}

export function deleteTagGroup(id: number): Promise<void> {
  return invoke("delete_tag_group", { id });
}

export async function getGenres(): Promise<Genre[]> {
  return invoke<Genre[]>("get_genres");
}

export function createGenre(name: string): Promise<Genre> {
  return invoke("create_genre", { name });
}

export function deleteGenre(id: number): Promise<void> {
  return invoke("delete_genre", { id });
}

export function getTagGroupItems(groupId: number): Promise<Tag[]> {
  return invoke("get_tag_group_items", { groupId });
}

export function addTagToGroup(groupId: number, tagId: number, sortOrder?: number): Promise<void> {
  return invoke("add_tag_to_group", { groupId, tagId, sortOrder: sortOrder ?? null });
}

export function removeTagFromGroup(groupId: number, tagId: number): Promise<void> {
  return invoke("remove_tag_from_group", { groupId, tagId });
}
