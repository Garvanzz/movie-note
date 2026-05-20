import { Check, Clock3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MovieWatchStatusValue = "unwatched" | "watched";

interface MovieWatchStatusMeta {
  value: MovieWatchStatusValue;
  label: string;
  icon: LucideIcon;
}

const STATUS_META: Record<MovieWatchStatusValue, MovieWatchStatusMeta> = {
  unwatched: { value: "unwatched", label: "未观看", icon: Clock3 },
  watched: { value: "watched", label: "已观看", icon: Check },
};

export const MOVIE_WATCH_STATUS_OPTIONS = [STATUS_META.unwatched, STATUS_META.watched] as const;

export function normalizeMovieWatchStatus(status: string | null | undefined): MovieWatchStatusValue {
  return status === "watched" ? "watched" : "unwatched";
}

export function getMovieWatchStatusMeta(status: string | null | undefined): MovieWatchStatusMeta {
  return STATUS_META[normalizeMovieWatchStatus(status)];
}