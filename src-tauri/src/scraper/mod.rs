use serde::{Deserialize, Serialize};
use javdb::JavDbScraper;
use javbus::JavBusScraper;

mod javdb;
mod javbus;

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

pub enum ScraperImpl {
    JavDb(JavDbScraper),
    JavBus(JavBusScraper),
}

impl ScraperImpl {
    pub fn name(&self) -> &'static str {
        match self {
            ScraperImpl::JavDb(_) => "javdb",
            ScraperImpl::JavBus(_) => "javbus",
        }
    }

    pub async fn search(&self, query: &str) -> Result<Vec<ScraperSearchResult>, String> {
        match self {
            ScraperImpl::JavDb(s) => s.search(query).await,
            ScraperImpl::JavBus(s) => s.search(query).await,
        }
    }

    pub async fn get_detail(&self, url: &str) -> Result<ScraperMovieDetail, String> {
        match self {
            ScraperImpl::JavDb(s) => s.get_detail(url).await,
            ScraperImpl::JavBus(s) => s.get_detail(url).await,
        }
    }
}

pub fn get_scrapers() -> Vec<ScraperImpl> {
    vec![
        ScraperImpl::JavDb(JavDbScraper),
        ScraperImpl::JavBus(JavBusScraper),
    ]
}
