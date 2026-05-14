import { invoke } from "@tauri-apps/api/core";
import type { Actor } from "@/types/actor";
import type { PaginatedResult } from "@/types/common";

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
