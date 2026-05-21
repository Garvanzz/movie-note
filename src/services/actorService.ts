import { invoke } from "./invoke";
import type { Actor, ActorCategory, ActorName, ActorNameKind, ActorSuggestion } from "@/types/actor";
import type { PaginatedResult } from "@/types/common";
import type { Tag } from "@/types/tag";

export function getActors(params: {
  search?: string;
  categoryId?: number;
  page: number;
  pageSize: number;
}): Promise<PaginatedResult<Actor>> {
  return invoke("get_actors", {
    search: params.search ?? null,
    categoryId: params.categoryId ?? null,
    page: params.page,
    pageSize: params.pageSize,
  });
}

export function getActor(id: number): Promise<Actor> {
  return invoke("get_actor", { id });
}

export function getActorNames(actorId: number): Promise<ActorName[]> {
  return invoke("get_actor_names", { actorId });
}

export function getActorCategories(): Promise<ActorCategory[]> {
  return invoke("get_actor_categories");
}

export function createActorCategory(name: string): Promise<ActorCategory> {
  return invoke("create_actor_category", { name });
}

export function moveActorCategory(id: number, direction: "up" | "down"): Promise<void> {
  return invoke("move_actor_category", { id, direction });
}

export function deleteActorCategory(id: number): Promise<void> {
  return invoke("delete_actor_category", { id });
}

export function getCategoriesForActor(actorId: number): Promise<ActorCategory[]> {
  return invoke("get_categories_for_actor", { actorId });
}

export function addActorToCategory(actorId: number, categoryId: number): Promise<void> {
  return invoke("add_actor_to_category", { actorId, categoryId });
}

export function addActorsToCategory(actorIds: number[], categoryId: number): Promise<void> {
  return invoke("add_actors_to_category", { actorIds, categoryId });
}

export function removeActorsFromCategory(actorIds: number[], categoryId: number): Promise<void> {
  return invoke("remove_actors_from_category", { actorIds, categoryId });
}

export function removeActorFromCategory(actorId: number, categoryId: number): Promise<void> {
  return invoke("remove_actor_from_category", { actorId, categoryId });
}

export function getActorAliases(actorId: number): Promise<string[]> {
  return invoke("get_actor_aliases", { actorId });
}

export function addActorName(actorId: number, name: string, kind: ActorNameKind, isPrimary = false): Promise<ActorName> {
  return invoke("add_actor_name", { actorId, name, kind, isPrimary });
}

export function addActorAlias(actorId: number, alias: string): Promise<void> {
  return invoke("add_actor_alias", { actorId, alias });
}

export function updateActorName(id: number, name: string, kind: ActorNameKind, isPrimary: boolean): Promise<ActorName> {
  return invoke("update_actor_name", { id, name, kind, isPrimary });
}

export function removeActorAlias(actorId: number, alias: string): Promise<void> {
  return invoke("remove_actor_alias", { actorId, alias });
}

export function removeActorName(id: number): Promise<void> {
  return invoke("remove_actor_name", { id });
}

export function suggestActors(query: string, limit = 6): Promise<ActorSuggestion[]> {
  return invoke("suggest_actors", { query, limit });
}

export function createActor(name: string): Promise<Actor> {
  return invoke("create_actor", { name });
}

export function updateActor(params: {
  id: number;
  name?: string;
  nameJp?: string;
  measurements?: string;
  birthDate?: string;
  debutYear?: number;
  rating?: number;
  comment?: string;
}): Promise<void> {
  return invoke("update_actor", {
    id: params.id,
    name: params.name ?? null,
    nameJp: params.nameJp ?? null,
    measurements: params.measurements ?? null,
    birthDate: params.birthDate ?? null,
    debutYear: params.debutYear ?? null,
    rating: params.rating ?? null,
    comment: params.comment ?? null,
  });
}

export function deleteActor(id: number): Promise<void> {
  return invoke("delete_actor", { id });
}

export function mergeActors(sourceActorId: number, targetActorId: number): Promise<Actor> {
  return invoke("merge_actors", { sourceActorId, targetActorId });
}

export function getActorTags(actorId: number): Promise<Tag[]> {
  return invoke("get_actor_tags", { actorId });
}

export function addActorTag(actorId: number, tagId: number): Promise<void> {
  return invoke("add_actor_tag", { actorId, tagId });
}

export function removeActorTag(actorId: number, tagId: number): Promise<void> {
  return invoke("remove_actor_tag", { actorId, tagId });
}
