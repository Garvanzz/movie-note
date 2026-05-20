use reqwest::header::{ACCEPT, ACCEPT_LANGUAGE};
use crate::scraper::{ScraperSearchResult, ScraperMovieDetail};

pub struct JavBusScraper;

impl JavBusScraper {
    pub async fn search(&self, query: &str) -> Result<Vec<ScraperSearchResult>, String> {
        let client = build_client()?;
        let url = format!("https://www.javbus.com/search/{}", query.trim().replace(' ', "-").replace('_', "-"));
        let html = client.get(&url)
            .send().await.map_err(|e| format!("请求失败: {e}"))?
            .text().await.map_err(|e| format!("读取响应失败: {e}"))?;
        parse_search(&html)
    }

    pub async fn get_detail(&self, url: &str) -> Result<ScraperMovieDetail, String> {
        let client = build_client()?;
        let url = if url.starts_with("http") { url.to_string() } else { format!("https://www.javbus.com{}", url) };
        let html = client.get(&url)
            .send().await.map_err(|e| format!("请求失败: {e}"))?
            .text().await.map_err(|e| format!("读取响应失败: {e}"))?;
        parse_detail(&html, &url)
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
            h.insert("Accept-Encoding", "gzip, deflate".parse().unwrap());
            h
        })
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {e}"))
}

fn parse_search(html: &str) -> Result<Vec<ScraperSearchResult>, String> {
    let document = scraper::Html::parse_document(html);
    let item_sel = scraper::Selector::parse("a.movie-box, .movie-box a, a[href*='/']").map_err(|e| e.to_string())?;
    let cover_sel = scraper::Selector::parse("img").map_err(|e| e.to_string())?;
    let date_sel = scraper::Selector::parse("date, .date").map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for item in document.select(&item_sel) {
        let url = item.attr("href").unwrap_or("");
        if url.is_empty() || url == "#" { continue; }
        let full_url = if url.starts_with("http") { url.to_string() } else { format!("https://www.javbus.com{}", url) };

        let raw = item.text().collect::<Vec<_>>().join(" ").trim().to_string();
        let code = extract_code(&raw).or_else(|| extract_code(url));
        let title = item.select(&cover_sel).next().and_then(|i| i.attr("title").map(String::from));
        let cover_url = item.select(&cover_sel).next().and_then(|i| {
            i.attr("src").map(String::from).or_else(|| i.attr("data-src").map(String::from))
        });
        let release_date = item.select(&date_sel).next().map(|e| e.text().collect::<Vec<_>>().join("").trim().to_string());

        if let Some(code) = code {
            results.push(ScraperSearchResult {
                code: code.to_uppercase(), title,
                cover_url, url: full_url,
                source: "javbus".to_string(),
                actors: Vec::new(), release_date,
            });
        }
    }
    Ok(results)
}

fn parse_detail(html: &str, source_url: &str) -> Result<ScraperMovieDetail, String> {
    let document = scraper::Html::parse_document(html);
    let code_sel = scraper::Selector::parse("h3, .container h3, .movie h3").map_err(|e| e.to_string())?;

    let raw_title = document.select(&code_sel).next()
        .map(|e| e.text().collect::<Vec<_>>().join(" ").trim().to_string())
        .unwrap_or_default();
    let code = extract_code(&raw_title).unwrap_or_default();

    let title = extract_text(&document, "h3, .title, h1");
    let actors = extract_all(&document, ".star-name a, .star a, a[href*='star']");
    let genres = extract_all(&document, ".genre a, a[href*='genre']");
    let tags = extract_all(&document, ".tag a");
    let runtime_str = extract_text(&document, "p:contains('長度'), p:contains('时长'), p:contains('長度')");
    let runtime = runtime_str.and_then(|s| {
        let s = s.chars().filter(|c| c.is_ascii_digit()).collect::<String>();
        s.parse::<i32>().ok()
    });
    let release_date = extract_text(&document, "p:contains('發行日期'), p:contains('发行日期')")
        .or_else(|| extract_text(&document, ".date"));

    let cover_sel = scraper::Selector::parse(".bigImage img, .movie-cover img, a.bigImage img").map_err(|e| e.to_string())?;
    let cover_url = document.select(&cover_sel).next().and_then(|e| e.attr("src").map(String::from));

    let sample_sel = scraper::Selector::parse("#sample-waterfall img, .sample-box img, .sample img").map_err(|e| e.to_string())?;
    let screenshots: Vec<String> = document.select(&sample_sel)
        .filter_map(|e| e.attr("src").map(String::from))
        .collect();

    Ok(ScraperMovieDetail {
        code: code.to_uppercase(), title,
        title_jp: None, actors, tags, genres,
        series: None, runtime, release_date, cover_url,
        screenshots,
        source_url: source_url.to_string(),
        source_site: "javbus".to_string(),
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

fn extract_code(text: &str) -> Option<String> {
    let re = regex::Regex::new(r"([A-Za-z]{2,6})[-_]?(\d{2,6})").ok()?;
    re.find(text).map(|m| m.as_str().to_uppercase().replace('_', "-"))
}
