use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScraperSearchResult {
    pub code: String,
    pub title: Option<String>,
    pub cover_url: Option<String>,
    pub url: String,
    pub source: String,
    pub actors: Vec<String>,
    pub release_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScraperMovieDetail {
    pub code: String,
    pub title: Option<String>,
    pub title_jp: Option<String>,
    pub actors: Vec<String>,
    pub tags: Vec<String>,
    pub genres: Vec<String>,
    pub series: Option<String>,
    pub runtime: Option<i32>,
    pub release_date: Option<String>,
    pub cover_url: Option<String>,
    pub screenshots: Vec<String>,
    pub source_url: String,
    pub source_site: String,
}

#[tauri::command]
pub fn scraper_search(_query: String) -> Result<Vec<ScraperSearchResult>, String> {
    // Scraper implementation placeholder.
    // To enable scraping, implement HTTP fetching of the source site and parse results.
    Err("Scraper not yet configured. Please implement the source site integration.".into())
}

#[tauri::command]
pub fn scraper_get_detail(_url: String, _source: String) -> Result<ScraperMovieDetail, String> {
    Err("Scraper not yet configured. Please implement the source site integration.".into())
}

#[tauri::command]
pub fn scraper_import(_detail: ScraperMovieDetail) -> Result<(), String> {
    Err("Scraper import not yet configured.".into())
}
