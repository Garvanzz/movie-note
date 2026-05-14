import { invoke } from "@tauri-apps/api/core";
import type { Movie, MovieFilter, MovieFilterOptions } from "@/types/movie";
import type { PaginatedResult } from "@/types/common";
import type { Tag } from "@/types/tag";

export function getMovies(
  filter: MovieFilter,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<Movie>> {
  return invoke("get_movies", { filter, page, pageSize });
}

export function getMovieByCode(code: string): Promise<Movie> {
  return invoke("get_movie_by_code", { code });
}

export function createMovie(
  code: string,
  title?: string,
  title_jp?: string,
  runtime?: number,
  release_date?: string,
): Promise<Movie> {
  return invoke("create_movie", { code, title, titleJp: title_jp, runtime, releaseDate: release_date });
}

export function updateMovie(
  code: string,
  data: Partial<Omit<Movie, "code" | "code_norm" | "created_at" | "updated_at" | "series"> & { series?: string }>,
): Promise<void> {
  return invoke("update_movie", {
    code,
    title: data.title,
    titleJp: data.title_jp,
    runtime: data.runtime,
    releaseDate: data.release_date,
    rating: data.rating,
    comment: data.comment,
    notes: data.notes,
    watchStatus: data.watch_status,
    series: data.series,
  });
}

export function deleteMovie(code: string): Promise<void> {
  return invoke("delete_movie", { code });
}

export function getMovieTags(code: string): Promise<Tag[]> {
  return invoke("get_movie_tags", { code });
}

export function addMovieTag(code: string, tagId: number): Promise<void> {
  return invoke("add_movie_tag", { code, tagId });
}

export function removeMovieTag(code: string, tagId: number): Promise<void> {
  return invoke("remove_movie_tag", { code, tagId });
}

export function getMovieFilterOptions(): Promise<MovieFilterOptions> {
  return invoke("get_movie_filter_options");
}
