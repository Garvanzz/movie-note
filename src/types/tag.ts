export interface Tag {
  id: number;
  name: string;
  description: string | null;
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
