import type { FilterOption } from "./common";

export interface Movie {
  code: string;
  code_norm: string;
  series: string | null;
  title: string | null;
  title_jp: string | null;
  runtime: number | null;
  release_date: string | null;
  rating: number | null;
  comment: string | null;
  notes: string | null;
  watch_status: string;
  cover_path: string | null;
  source_url: string | null;
  source_site: string | null;
  created_at: string;
  updated_at: string;
}

export interface MovieFilter {
  search?: string;
  tag_ids?: number[];
  actor_ids?: number[];
  genre_ids?: number[];
  series?: string;
  rating_min?: number;
  rating_max?: number;
  watch_status?: string;
  has_files?: boolean;
  sort_by?: string;
  sort_dir?: string;
}

export interface MovieFilterOptions {
  tags: FilterOption[];
  series: FilterOption[];
}
