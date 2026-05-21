use rusqlite::params;
use tauri::State;
use crate::code_parser::normalize_for_storage;
use crate::db::Database;
use crate::scraper::{self, ScraperSearchResult, ScraperMovieDetail};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub async fn scraper_search(query: String) -> Result<Vec<ScraperSearchResult>, String> {
    let scrapers = scraper::get_scrapers();
    let mut all_results = Vec::new();
    for scraper in scrapers {
        match scraper.search(&query).await {
            Ok(mut results) => all_results.append(&mut results),
            Err(e) => eprintln!("{} scraper error: {}", scraper.name(), e),
        }
    }
    // Deduplicate by code
    let mut seen = std::collections::HashSet::new();
    all_results.retain(|r| seen.insert(r.code.clone()));
    Ok(all_results)
}

#[tauri::command]
pub async fn scraper_get_detail(url: String, source: String) -> Result<ScraperMovieDetail, String> {
    let scrapers = scraper::get_scrapers();
    for scraper in scrapers {
        if scraper.name() == source {
            return scraper.get_detail(&url).await;
        }
    }
    Err(format!("Unknown source: {source}"))
}

#[tauri::command]
pub async fn scraper_import(db: State<'_, Database>, detail: ScraperMovieDetail) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let parsed = normalize_for_storage(&detail.code);
    let canonical_code = parsed.canonical.clone();
    let series = crate::code_parser::extract_series(&canonical_code);

    // Insert or update movie
    conn.execute(
        "INSERT INTO movies (code, code_norm, code_kind, code_sort_key, series, title, title_jp, runtime, release_date, cover_path, source_url, source_site) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) \
         ON CONFLICT(code) DO UPDATE SET \
         title=COALESCE(?6,title), title_jp=COALESCE(?7,title_jp), runtime=COALESCE(?8,runtime), \
         release_date=COALESCE(?9,release_date), cover_path=COALESCE(?10,cover_path), \
         source_url=COALESCE(?11,source_url), source_site=COALESCE(?12,source_site), \
         code_norm=excluded.code_norm, code_kind=excluded.code_kind, code_sort_key=excluded.code_sort_key",
        rusqlite::params![
            canonical_code,
            parsed.code_norm,
            parsed.kind.as_str(),
            parsed.sort_key,
            series,
            detail.title,
            detail.title_jp,
            detail.runtime,
            detail.release_date,
            detail.cover_url,
            detail.source_url,
            detail.source_site,
        ],
    ).map_err(|e| format!("插入影片失败: {e}"))?;

    // Import actors
    for actor_name in &detail.actors {
        conn.execute(
            "INSERT OR IGNORE INTO actors (name) VALUES (?1)",
            rusqlite::params![actor_name],
        ).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR IGNORE INTO movie_actors (code, actor_id) \
             SELECT ?1, id FROM actors WHERE name = ?2",
            rusqlite::params![parsed.canonical, actor_name],
        ).map_err(|e| e.to_string())?;
    }

    // Import tags
    for tag_name in &detail.tags {
        conn.execute(
            "INSERT INTO tags (name, scope) VALUES (?1, 'movie') \
             ON CONFLICT(name) DO UPDATE SET scope = CASE WHEN tags.scope = 'actor' THEN 'both' ELSE tags.scope END",
            rusqlite::params![tag_name],
        ).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR IGNORE INTO movie_tags (code, tag_id) \
             SELECT ?1, id FROM tags WHERE name = ?2",
            rusqlite::params![parsed.canonical, tag_name],
        ).map_err(|e| e.to_string())?;
    }

    // Import genres
    for genre_name in &detail.genres {
        conn.execute(
            "INSERT OR IGNORE INTO genres (name) VALUES (?1)",
            rusqlite::params![genre_name],
        ).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR IGNORE INTO movie_genres (code, genre_id) \
             SELECT ?1, id FROM genres WHERE name = ?2",
            rusqlite::params![parsed.canonical, genre_name],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn download_image(app_data: &PathBuf, url: &str) -> Result<String, String> {
    let resp = reqwest::get(url).await.map_err(|e| format!("下载失败: {}", e))?;
    let ct = resp.headers().get("content-type")
        .and_then(|v| v.to_str().ok()).unwrap_or("");
    let ext = if ct == "image/png" { "png" }
        else if ct == "image/gif" { "gif" }
        else if ct == "image/webp" { "webp" }
        else { "jpg" };
    let bytes = resp.bytes().await.map_err(|e| format!("读取失败: {}", e))?;
    let filename = format!("{}.{}.{}", std::process::id(),
        SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0), ext);
    let dir = app_data.join("images");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建图片目录失败: {}", e))?;
    let dest = dir.join(&filename);
    std::fs::write(&dest, &bytes).map_err(|e| format!("写入失败: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn scraper_download_images(db: State<'_, Database>, code: String, cover_url: Option<String>, screenshots: Vec<String>) -> Result<(), String> {
    let app_data = db.app_data_dir.clone();
    let code_upper = code.to_uppercase();

    // Download cover
    if let Some(cover_url) = &cover_url {
        if !cover_url.is_empty() {
            match download_image(&app_data, cover_url).await {
                Ok(new_path) => {
                    let conn = db.conn.lock().map_err(|e| e.to_string())?;
                    // If the movie already has a cover_path that's a remote URL, replace it
                    let old_cover: Option<String> = conn.query_row(
                        "SELECT cover_path FROM movies WHERE code = ?1",
                        params![code_upper],
                        |row| row.get(0),
                    ).ok().flatten();
                    let existing_primary: Option<i64> = conn.query_row(
                        "SELECT id FROM movie_covers WHERE code = ?1 AND is_primary = 1 LIMIT 1",
                        params![code_upper],
                        |row| row.get(0),
                    ).ok();
                    if let Some(old_id) = existing_primary {
                        conn.execute("UPDATE movie_covers SET image_path = ?1 WHERE id = ?2",
                            params![new_path, old_id]).map_err(|e| e.to_string())?;
                    } else {
                        conn.execute("INSERT INTO movie_covers (code, image_path, is_primary, source) VALUES (?1, ?2, 1, 'scraper')",
                            params![code_upper, new_path]).map_err(|e| e.to_string())?;
                    }
                    if let Some(old) = old_cover {
                        if old.starts_with("http") {
                            // Delete old remote URL reference (not a local file, just clear)
                        }
                    }
                    conn.execute("UPDATE movies SET cover_path = ?1, updated_at = datetime('now') WHERE code = ?2",
                        params![new_path, code_upper]).map_err(|e| e.to_string())?;
                }
                Err(e) => eprintln!("Failed to download cover: {}", e),
            }
        }
    }

    // Download screenshots
    for (i, url) in screenshots.iter().enumerate() {
        match download_image(&app_data, url).await {
            Ok(new_path) => {
                let conn = db.conn.lock().map_err(|e| e.to_string())?;
                let _ = conn.execute(
                    "INSERT INTO movie_screenshots (code, image_path, sort_order) VALUES (?1, ?2, ?3)",
                    params![code_upper, new_path, i as i32],
                );
            }
            Err(e) => eprintln!("Failed to download screenshot: {}", e),
        }
    }

    Ok(())
}
