use serde::{Deserialize, Serialize};
use javdb::JavDbScraper;
use javbus::JavBusScraper;

mod javdb;
mod javbus;

/// Build a reqwest client shared by all scrapers.
/// Pass an optional proxy URL like `socks5://127.0.0.1:1080` or `http://127.0.0.1:7890`.
pub(crate) fn build_scraper_client(proxy_url: Option<&str>) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .cookie_store(true)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .default_headers({
            let mut h = reqwest::header::HeaderMap::new();
            use reqwest::header::{ACCEPT, ACCEPT_LANGUAGE};
            h.insert(ACCEPT, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8".parse().unwrap());
            h.insert(ACCEPT_LANGUAGE, "zh-CN,zh;q=0.9,ja;q=0.8".parse().unwrap());
            h
        })
        .timeout(std::time::Duration::from_secs(15));

    if let Some(proxy) = proxy_url {
        let proxy = reqwest::Proxy::all(proxy)
            .map_err(|e| format!("无效代理地址: {e}"))?;
        builder = builder.proxy(proxy);
    }

    builder.build().map_err(|e| format!("创建HTTP客户端失败: {e}"))
}

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

    pub async fn search(&self, query: &str, proxy_url: Option<&str>) -> Result<Vec<ScraperSearchResult>, String> {
        match self {
            ScraperImpl::JavDb(s) => s.search(query, proxy_url).await,
            ScraperImpl::JavBus(s) => s.search(query, proxy_url).await,
        }
    }

    pub async fn get_detail(&self, url: &str, proxy_url: Option<&str>) -> Result<ScraperMovieDetail, String> {
        match self {
            ScraperImpl::JavDb(s) => s.get_detail(url, proxy_url).await,
            ScraperImpl::JavBus(s) => s.get_detail(url, proxy_url).await,
        }
    }
}

pub fn get_scrapers() -> Vec<ScraperImpl> {
    vec![
        ScraperImpl::JavDb(JavDbScraper),
        ScraperImpl::JavBus(JavBusScraper),
    ]
}
