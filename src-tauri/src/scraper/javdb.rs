use reqwest::header::{ACCEPT, ACCEPT_LANGUAGE};
use crate::scraper::{ScraperSearchResult, ScraperMovieDetail};

pub struct JavDbScraper;

impl JavDbScraper {
    pub async fn search(&self, query: &str) -> Result<Vec<ScraperSearchResult>, String> {
        let client = build_client()?;
        let url = format!("https://javdb.com/search?q={}&f=all", urlencoding(query));
        let html = client.get(&url)
            .send().await.map_err(|e| format!("请求失败: {e}"))?
            .text().await.map_err(|e| format!("读取响应失败: {e}"))?;
        parse_search_results(&html, "javdb")
    }

    pub async fn get_detail(&self, url: &str) -> Result<ScraperMovieDetail, String> {
        let client = build_client()?;
        let url = if url.starts_with("http") { url.to_string() } else { format!("https://javdb.com{}", url) };
        let html = client.get(&url)
            .send().await.map_err(|e| format!("请求失败: {e}"))?
            .text().await.map_err(|e| format!("读取响应失败: {e}"))?;
        parse_detail(&html, &url, "javdb")
    }
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .cookie_store(true)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .default_headers({
            let mut h = reqwest::header::HeaderMap::new();
            h.insert(ACCEPT, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8".parse().unwrap());
            h.insert(ACCEPT_LANGUAGE, "zh-CN,zh;q=0.9,ja;q=0.8".parse().unwrap());
            h
        })
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {e}"))
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('-', "-")
}

fn parse_search_results(html: &str, source: &str) -> Result<Vec<ScraperSearchResult>, String> {
    let document = scraper::Html::parse_document(html);
    let item_sel = scraper::Selector::parse(".movie-list .item, .movie-list .grid-item, .movie-list > div > a").map_err(|e| e.to_string())?;
    let title_sel = scraper::Selector::parse(".video-title, .title, strong").map_err(|e| e.to_string())?;
    let code_sel = scraper::Selector::parse(".uid, .video-code, .code").map_err(|e| e.to_string())?;
    let cover_sel = scraper::Selector::parse("img").map_err(|e| e.to_string())?;
    let date_sel = scraper::Selector::parse(".date, .meta").map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for item in document.select(&item_sel) {
        let url = item.attr("href").unwrap_or("").to_string();
        if url.is_empty() { continue; }
        let full_url = if url.starts_with("http") { url.clone() } else { format!("https://javdb.com{}", url) };

        let title = item.select(&title_sel).next().map(|e| e.text().collect::<Vec<_>>().join(" ").trim().to_string());
        let code = item.select(&code_sel).next()
            .map(|e| e.text().collect::<Vec<_>>().join("").trim().to_string())
            .or_else(|| title.as_ref().and_then(|t| extract_code_from_title(t)));
        let cover_url = item.select(&cover_sel).next().and_then(|e| e.attr("src").map(String::from));
        let release_date = item.select(&date_sel).next()
            .map(|e| e.text().collect::<Vec<_>>().join("").trim().to_string());

        if let Some(code) = code {
            let code = code.to_uppercase();
            results.push(ScraperSearchResult {
                code, title, cover_url,
                url: full_url, source: source.to_string(),
                actors: Vec::new(), release_date,
            });
        }
    }
    Ok(results)
}

fn parse_detail(html: &str, source_url: &str, source_site: &str) -> Result<ScraperMovieDetail, String> {
    let document = scraper::Html::parse_document(html);
    let title = extract_text(&document, ".title, .movie-title, h1, .video-title strong");
    let code = title.as_ref().and_then(|t| extract_code_from_title(t)).unwrap_or_default();
    let actors = extract_all(&document, ".actor-name a, .star-name a, .cast a");
    let genres = extract_all(&document, ".genre a");
    let tags = extract_all(&document, ".tag a, .tags a");
    let runtime_str = extract_text(&document, ".runtime, .duration");
    let runtime = runtime_str.and_then(|s| s.trim().replace("min", "").replace("分钟", "").trim().parse::<i32>().ok());
    let release_date = extract_text(&document, ".date, .release-date");
    let cover_url = document.select(&scraper::Selector::parse("img.video-cover, .movie-cover img, .cover img, .video-cover img").map_err(|e| e.to_string())?)
        .next().and_then(|e| e.attr("src").map(String::from));

    Ok(ScraperMovieDetail {
        code: code.to_uppercase(), title,
        title_jp: None, actors, tags, genres,
        series: None, runtime, release_date, cover_url,
        screenshots: Vec::new(),
        source_url: source_url.to_string(),
        source_site: source_site.to_string(),
    })
}

fn extract_text(doc: &scraper::Html, selector_str: &str) -> Option<String> {
    let sel = scraper::Selector::parse(selector_str).ok()?;
    doc.select(&sel).next().map(|e| e.text().collect::<Vec<_>>().join(" ").trim().to_string())
}

fn extract_all(doc: &scraper::Html, selector_str: &str) -> Vec<String> {
    let sel = match scraper::Selector::parse(selector_str) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    doc.select(&sel).map(|e| e.text().collect::<Vec<_>>().join("").trim().to_string()).collect()
}

fn extract_code_from_title(title: &str) -> Option<String> {
    let re = regex::Regex::new(r"([A-Z]{2,6})[-_]?(\d{2,6})").ok()?;
    re.find(title).map(|m| m.as_str().to_uppercase().replace('_', "-"))
}
