import { invoke } from "./invoke";
import type { Tag, TagGroup, Genre } from "@/types/tag";

export function getTags(): Promise<Tag[]> {
  return invoke("get_tags");
}

export function createTag(name: string): Promise<Tag> {
  return invoke("create_tag", { name });
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

export function getGenres(): Promise<Genre[]> {
  return invoke("get_genres");
}

export function createGenre(name: string): Promise<Genre> {
  return invoke("create_genre", { name });
}

export function deleteGenre(id: number): Promise<void> {
  return invoke("delete_genre", { id });
}
