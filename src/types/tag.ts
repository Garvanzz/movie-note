export type TagScope = "movie" | "actor" | "both";

export interface Tag {
  id: number;
  name: string;
  description: string | null;
  scope: TagScope;
}

export interface TagGroup {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface Genre {
  id: number;
  name: string;
  description: string | null;
}

export interface TagGroupWithTags extends TagGroup {
  tags: Tag[];
}
