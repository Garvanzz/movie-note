import { invoke } from "@tauri-apps/api/core";

export interface ScraperSearchResult {
  code: string;
  title: string | null;
  cover_url: string | null;
  url: string;
  source: string;
  actors: string[];
  release_date: string | null;
}

export interface ScraperMovieDetail {
  code: string;
  title: string | null;
  title_jp: string | null;
  actors: string[];
  tags: string[];
  genres: string[];
  series: string | null;
  runtime: number | null;
  release_date: string | null;
  cover_url: string | null;
  screenshots: string[];
  source_url: string;
  source_site: string;
}

export function scraperSearch(query: string): Promise<ScraperSearchResult[]> {
  return invoke("scraper_search", { query });
}

export function scraperGetDetail(url: string, source: string): Promise<ScraperMovieDetail> {
  return invoke("scraper_get_detail", { url, source });
}

export function scraperImport(detail: ScraperMovieDetail): Promise<void> {
  return invoke("scraper_import", { detail });
}
