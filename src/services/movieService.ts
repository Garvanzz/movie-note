import { invoke } from "./invoke";
import type { Movie, MovieFilter, MovieFilterOptions, MovieSuggestion } from "@/types/movie";
import type { PaginatedResult } from "@/types/common";
import type { Tag, Genre } from "@/types/tag";
import type { Actor } from "@/types/actor";

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

export function suggestMovies(query: string, limit = 6): Promise<MovieSuggestion[]> {
  return invoke("suggest_movies", { query, limit });
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
  data: Partial<
    Omit<Movie, "code" | "code_norm" | "created_at" | "updated_at" | "series"> & {
      series?: string;
      source_url?: string;
      source_site?: string;
    }
  >,
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
    sourceUrl: data.source_url,
    sourceSite: data.source_site,
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

export function getMovieGenres(code: string): Promise<Genre[]> {
  return invoke("get_movie_genres", { code });
}

export function addMovieGenre(code: string, genreId: number): Promise<void> {
  return invoke("add_movie_genre", { code, genreId });
}

export function removeMovieGenre(code: string, genreId: number): Promise<void> {
  return invoke("remove_movie_genre", { code, genreId });
}

export function getMovieActors(code: string): Promise<Actor[]> {
  return invoke("get_movie_actors", { code });
}

export function addMovieActor(code: string, actorId: number): Promise<void> {
  return invoke("add_movie_actor", { code, actorId });
}

export function removeMovieActor(code: string, actorId: number): Promise<void> {
  return invoke("remove_movie_actor", { code, actorId });
}
