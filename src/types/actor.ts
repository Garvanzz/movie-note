export interface Actor {
  id: number;
  name: string;
  name_jp: string | null;
  measurements: string | null;
  birth_date: string | null;
  debut_year: number | null;
  rating: number | null;
  comment: string | null;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActorCategory {
  id: number;
  name: string;
  sort_order: number;
}

export type ActorNameKind = "native" | "japanese" | "romanized" | "translated" | "stage" | "alias";

export interface ActorName {
  id: number;
  actor_id: number;
  name: string;
  kind: ActorNameKind;
  is_primary: boolean;
  sort_order: number;
}

export interface ActorSuggestion {
  id: number;
  name: string;
  name_jp: string | null;
  matched_name: string;
  match_kind: string;
}
