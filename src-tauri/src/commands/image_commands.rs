use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use rusqlite::{params, Connection};
use tauri::State;
use crate::db::Database;
use crate::models::{MovieCover, MovieScreenshot, ActorImage, SavedImage};

// ── helpers ──

fn unique_filename(ext: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let random: u16 = (nanos ^ (nanos >> 16) ^ (nanos >> 32) ^ (nanos >> 48)) as u16;
    format!("{:x}_{:04x}.{}", nanos, random, ext)
}

fn ensure_images_dir(app_data: &PathBuf) -> PathBuf {
    let dir = app_data.join("images");
    std::fs::create_dir_all(&dir).ok();
    dir
}

fn extension_from_path(path: &str) -> &str {
    std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
}

fn extension_from_content_type(ct: &str) -> &str {
    match ct {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/bmp" => "bmp",
        _ => "jpg",
    }
}

fn copy_file_to_images(app_data: &PathBuf, source: &str) -> Result<String, String> {
    let ext = extension_from_path(source).to_lowercase();
    let filename = unique_filename(&ext);
    let dir = ensure_images_dir(app_data);
    let dest = dir.join(&filename);
    std::fs::copy(source, &dest)
        .map_err(|e| format!("复制文件失败: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

pub(crate) fn download_url_to_images(app_data: &PathBuf, url: &str) -> Result<String, String> {
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    let resp = rt.block_on(async {
        reqwest::get(url).await.map_err(|e| format!("下载失败: {}", e))
    })?;
    let ct = resp.headers().get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let ext = extension_from_content_type(&ct);
    let ext = if ct == "application/octet-stream" || ct.is_empty() {
        extension_from_path(url)
    } else {
        ext
    };
    let bytes = rt.block_on(async {
        resp.bytes().await.map_err(|e| format!("读取响应失败: {}", e))
    })?;
    let filename = unique_filename(ext);
    let dir = ensure_images_dir(app_data);
    let dest = dir.join(&filename);
    std::fs::write(&dest, &bytes)
        .map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

pub(crate) fn delete_image_file(path: &str) {
    std::fs::remove_file(path).ok();
}

fn maybe_delete_unused_actor_avatar(conn: &Connection, app_data: &PathBuf, old_path: Option<String>) {
    let Some(path) = old_path else {
        return;
    };

    let images_prefix = app_data.join("images").to_string_lossy().to_string();
    if !path.starts_with(&images_prefix) {
        return;
    }

    let still_used_in_gallery = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM actor_images WHERE image_path = ?1)",
            params![path.as_str()],
            |row| row.get::<_, i32>(0),
        )
        .map(|value| value != 0)
        .unwrap_or(false);

    if !still_used_in_gallery {
        delete_image_file(&path);
    }
}

// ── movie cover commands ──

#[tauri::command]
pub fn get_movie_covers(db: State<Database>, code: String) -> Result<Vec<MovieCover>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, code, image_path, is_primary, source FROM movie_covers WHERE code = ?1 ORDER BY id ASC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![code.to_uppercase()], |row| {
        Ok(MovieCover {
            id: row.get(0)?,
            code: row.get(1)?,
            image_path: row.get(2)?,
            is_primary: row.get::<_, i32>(3)? != 0,
            source: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_movie_cover(db: State<Database>, code: String, file_path: String, set_primary: Option<bool>) -> Result<MovieCover, String> {
    let app_data = db.app_data_dir.clone();
    let new_path = copy_file_to_images(&app_data, &file_path)?;
    let is_primary = set_primary.unwrap_or(false);
    let code_upper = code.to_uppercase();

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if is_primary {
        conn.execute("UPDATE movie_covers SET is_primary = 0 WHERE code = ?1", params![code_upper])
            .map_err(|e| e.to_string())?;
        conn.execute("UPDATE movies SET cover_path = ?1, updated_at = datetime('now') WHERE code = ?2",
            params![new_path, code_upper])
            .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "INSERT INTO movie_covers (code, image_path, is_primary, source) VALUES (?1, ?2, ?3, 'local')",
        params![code_upper, new_path, if is_primary { 1 } else { 0 }],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(MovieCover { id, code: code_upper, image_path: new_path, is_primary, source: "local".into() })
}

#[tauri::command]
pub fn add_movie_cover_from_url(db: State<Database>, code: String, url: String, set_primary: Option<bool>) -> Result<MovieCover, String> {
    let app_data = db.app_data_dir.clone();
    let new_path = download_url_to_images(&app_data, &url)?;
    let is_primary = set_primary.unwrap_or(false);
    let code_upper = code.to_uppercase();

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if is_primary {
        conn.execute("UPDATE movie_covers SET is_primary = 0 WHERE code = ?1", params![code_upper])
            .map_err(|e| e.to_string())?;
        conn.execute("UPDATE movies SET cover_path = ?1, updated_at = datetime('now') WHERE code = ?2",
            params![new_path, code_upper])
            .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "INSERT INTO movie_covers (code, image_path, is_primary, source) VALUES (?1, ?2, ?3, 'url')",
        params![code_upper, new_path, if is_primary { 1 } else { 0 }],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(MovieCover { id, code: code_upper, image_path: new_path, is_primary, source: "url".into() })
}

#[tauri::command]
pub fn remove_movie_cover(db: State<Database>, code: String, cover_id: i64) -> Result<(), String> {
    let code_upper = code.to_uppercase();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get the cover to remove
    let (path, was_primary): (String, bool) = conn.query_row(
        "SELECT image_path, is_primary FROM movie_covers WHERE id = ?1",
        params![cover_id],
        |row| Ok((row.get(0)?, row.get::<_, i32>(1)? != 0))
    ).map_err(|e| format!("封面不存�? {}", e))?;

    conn.execute("DELETE FROM movie_covers WHERE id = ?1", params![cover_id])
        .map_err(|e| e.to_string())?;
    delete_image_file(&path);

    if was_primary {
        // Try to promote the next cover
        let next: Option<(i64, String)> = conn.query_row(
            "SELECT id, image_path FROM movie_covers WHERE code = ?1 ORDER BY is_primary DESC, id ASC LIMIT 1",
            params![code_upper],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).ok();

        if let Some((next_id, next_path)) = next {
            conn.execute("UPDATE movie_covers SET is_primary = 1 WHERE id = ?1", params![next_id])
                .map_err(|e| e.to_string())?;
            conn.execute("UPDATE movies SET cover_path = ?1, updated_at = datetime('now') WHERE code = ?2",
                params![next_path, code_upper])
                .map_err(|e| e.to_string())?;
        } else {
            conn.execute("UPDATE movies SET cover_path = NULL, updated_at = datetime('now') WHERE code = ?1",
                params![code_upper])
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn set_movie_primary_cover(db: State<Database>, code: String, cover_id: i64) -> Result<(), String> {
    let code_upper = code.to_uppercase();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let new_path: String = conn.query_row(
        "SELECT image_path FROM movie_covers WHERE id = ?1",
        params![cover_id],
        |row| row.get(0),
    ).map_err(|e| format!("封面不存�? {}", e))?;

    conn.execute("UPDATE movie_covers SET is_primary = 0 WHERE code = ?1", params![code_upper])
        .map_err(|e| e.to_string())?;
    conn.execute("UPDATE movie_covers SET is_primary = 1 WHERE id = ?1", params![cover_id])
        .map_err(|e| e.to_string())?;
    conn.execute("UPDATE movies SET cover_path = ?1, updated_at = datetime('now') WHERE code = ?2",
        params![new_path, code_upper])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── movie screenshot commands ──

#[tauri::command]
pub fn get_movie_screenshots(db: State<Database>, code: String) -> Result<Vec<MovieScreenshot>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, code, image_path, sort_order FROM movie_screenshots WHERE code = ?1 ORDER BY sort_order ASC, id ASC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![code.to_uppercase()], |row| {
        Ok(MovieScreenshot {
            id: row.get(0)?,
            code: row.get(1)?,
            image_path: row.get(2)?,
            sort_order: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_movie_screenshot(db: State<Database>, code: String, file_path: String) -> Result<MovieScreenshot, String> {
    let app_data = db.app_data_dir.clone();
    let new_path = copy_file_to_images(&app_data, &file_path)?;
    let code_upper = code.to_uppercase();

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let max_order: i32 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM movie_screenshots WHERE code = ?1",
        params![code_upper],
        |row| row.get(0),
    ).unwrap_or(-1);
    let sort_order = max_order + 1;

    conn.execute(
        "INSERT INTO movie_screenshots (code, image_path, sort_order) VALUES (?1, ?2, ?3)",
        params![code_upper, new_path, sort_order],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(MovieScreenshot { id, code: code_upper, image_path: new_path, sort_order })
}

#[tauri::command]
pub fn add_movie_screenshot_from_url(db: State<Database>, code: String, url: String) -> Result<MovieScreenshot, String> {
    let app_data = db.app_data_dir.clone();
    let new_path = download_url_to_images(&app_data, &url)?;
    let code_upper = code.to_uppercase();

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let max_order: i32 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM movie_screenshots WHERE code = ?1",
        params![code_upper],
        |row| row.get(0),
    ).unwrap_or(-1);
    let sort_order = max_order + 1;

    conn.execute(
        "INSERT INTO movie_screenshots (code, image_path, sort_order) VALUES (?1, ?2, ?3)",
        params![code_upper, new_path, sort_order],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(MovieScreenshot { id, code: code_upper, image_path: new_path, sort_order })
}

#[tauri::command]
pub fn remove_movie_screenshot(db: State<Database>, screenshot_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let path: String = conn.query_row(
        "SELECT image_path FROM movie_screenshots WHERE id = ?1",
        params![screenshot_id],
        |row| row.get(0),
    ).map_err(|e| format!("截图不存�? {}", e))?;
    conn.execute("DELETE FROM movie_screenshots WHERE id = ?1", params![screenshot_id])
        .map_err(|e| e.to_string())?;
    delete_image_file(&path);
    Ok(())
}

// ── actor avatar commands ──

#[tauri::command]
pub fn set_actor_avatar(db: State<Database>, actor_id: i64, file_path: String) -> Result<String, String> {
    let app_data = db.app_data_dir.clone();
    let new_path = copy_file_to_images(&app_data, &file_path)?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let old_path: Option<String> = conn.query_row(
        "SELECT avatar_path FROM actors WHERE id = ?1",
        params![actor_id],
        |row| row.get(0),
    ).ok().flatten();
    maybe_delete_unused_actor_avatar(&conn, &app_data, old_path);

    conn.execute("UPDATE actors SET avatar_path = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_path, actor_id])
        .map_err(|e| e.to_string())?;
    Ok(new_path)
}

#[tauri::command]
pub fn set_actor_avatar_from_url(db: State<Database>, actor_id: i64, url: String) -> Result<String, String> {
    let app_data = db.app_data_dir.clone();
    let new_path = download_url_to_images(&app_data, &url)?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let old_path: Option<String> = conn.query_row(
        "SELECT avatar_path FROM actors WHERE id = ?1",
        params![actor_id],
        |row| row.get(0),
    ).ok().flatten();
    maybe_delete_unused_actor_avatar(&conn, &app_data, old_path);

    conn.execute("UPDATE actors SET avatar_path = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_path, actor_id])
        .map_err(|e| e.to_string())?;
    Ok(new_path)
}

#[tauri::command]
pub fn set_actor_avatar_from_image(db: State<Database>, actor_id: i64, image_id: i64) -> Result<String, String> {
    let app_data = db.app_data_dir.clone();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let new_path: String = conn
        .query_row(
            "SELECT image_path FROM actor_images WHERE id = ?1 AND actor_id = ?2",
            params![image_id, actor_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let old_path: Option<String> = conn.query_row(
        "SELECT avatar_path FROM actors WHERE id = ?1",
        params![actor_id],
        |row| row.get(0),
    ).ok().flatten();
    maybe_delete_unused_actor_avatar(&conn, &app_data, old_path);

    conn.execute("UPDATE actors SET avatar_path = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_path, actor_id])
        .map_err(|e| e.to_string())?;
    Ok(new_path)
}

#[tauri::command]
pub fn remove_actor_avatar(db: State<Database>, actor_id: i64) -> Result<(), String> {
    let app_data = db.app_data_dir.clone();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let old_path: Option<String> = conn.query_row(
        "SELECT avatar_path FROM actors WHERE id = ?1",
        params![actor_id],
        |row| row.get(0),
    ).ok().flatten();
    maybe_delete_unused_actor_avatar(&conn, &app_data, old_path);
    conn.execute("UPDATE actors SET avatar_path = NULL, updated_at = datetime('now') WHERE id = ?1",
        params![actor_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── actor image commands ──

#[tauri::command]
pub fn get_actor_images(db: State<Database>, actor_id: i64) -> Result<Vec<ActorImage>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, actor_id, image_path, sort_order FROM actor_images WHERE actor_id = ?1 ORDER BY sort_order ASC, id ASC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![actor_id], |row| {
        Ok(ActorImage {
            id: row.get(0)?,
            actor_id: row.get(1)?,
            image_path: row.get(2)?,
            sort_order: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_actor_image(db: State<Database>, actor_id: i64, file_path: String) -> Result<ActorImage, String> {
    let app_data = db.app_data_dir.clone();
    let new_path = copy_file_to_images(&app_data, &file_path)?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let max_order: i32 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM actor_images WHERE actor_id = ?1",
        params![actor_id],
        |row| row.get(0),
    ).unwrap_or(-1);
    let sort_order = max_order + 1;

    conn.execute(
        "INSERT INTO actor_images (actor_id, image_path, sort_order) VALUES (?1, ?2, ?3)",
        params![actor_id, new_path, sort_order],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(ActorImage { id, actor_id, image_path: new_path, sort_order })
}

#[tauri::command]
pub fn add_actor_image_from_url(db: State<Database>, actor_id: i64, url: String) -> Result<ActorImage, String> {
    let app_data = db.app_data_dir.clone();
    let new_path = download_url_to_images(&app_data, &url)?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let max_order: i32 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM actor_images WHERE actor_id = ?1",
        params![actor_id],
        |row| row.get(0),
    ).unwrap_or(-1);
    let sort_order = max_order + 1;

    conn.execute(
        "INSERT INTO actor_images (actor_id, image_path, sort_order) VALUES (?1, ?2, ?3)",
        params![actor_id, new_path, sort_order],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(ActorImage { id, actor_id, image_path: new_path, sort_order })
}

#[tauri::command]
pub fn remove_actor_image(db: State<Database>, image_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let (actor_id, path): (i64, String) = conn.query_row(
        "SELECT actor_id, image_path FROM actor_images WHERE id = ?1",
        params![image_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| format!("图片不存�? {}", e))?;
    conn.execute("DELETE FROM actor_images WHERE id = ?1", params![image_id])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE actors SET avatar_path = NULL, updated_at = datetime('now') WHERE id = ?1 AND avatar_path = ?2",
        params![actor_id, path],
    )
    .map_err(|e| e.to_string())?;
    delete_image_file(&path);
    Ok(())
}

// ── generic paste/bytes command ──

#[tauri::command]
pub fn save_image_bytes(
    db: State<Database>,
    image_type: String,
    owner: String,
    bytes: Vec<u8>,
    filename: String,
) -> Result<SavedImage, String> {
    let app_data = db.app_data_dir.clone();
    let ext = extension_from_path(&filename).to_lowercase();
    let unique_name = unique_filename(&ext);
    let dir = ensure_images_dir(&app_data);
    let dest = dir.join(&unique_name);
    let dest_str = dest.to_string_lossy().to_string();

    std::fs::write(&dest, &bytes).map_err(|e| format!("写入文件失败: {}", e))?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    match image_type.as_str() {
        "movie_screenshot" => {
            let code_upper = owner.to_uppercase();
            let max_order: i32 = conn.query_row(
                "SELECT COALESCE(MAX(sort_order), -1) FROM movie_screenshots WHERE code = ?1",
                params![code_upper],
                |row| row.get(0),
            ).unwrap_or(-1);
            let sort_order = max_order + 1;
            conn.execute(
                "INSERT INTO movie_screenshots (code, image_path, sort_order) VALUES (?1, ?2, ?3)",
                params![code_upper, dest_str, sort_order],
            ).map_err(|e| e.to_string())?;
            let id = conn.last_insert_rowid();
            Ok(SavedImage { id, image_path: dest_str })
        }
        "actor_image" => {
            let actor_id: i64 = owner.parse().map_err(|_| "无效的演员ID".to_string())?;
            let max_order: i32 = conn.query_row(
                "SELECT COALESCE(MAX(sort_order), -1) FROM actor_images WHERE actor_id = ?1",
                params![actor_id],
                |row| row.get(0),
            ).unwrap_or(-1);
            let sort_order = max_order + 1;
            conn.execute(
                "INSERT INTO actor_images (actor_id, image_path, sort_order) VALUES (?1, ?2, ?3)",
                params![actor_id, dest_str, sort_order],
            ).map_err(|e| e.to_string())?;
            let id = conn.last_insert_rowid();
            Ok(SavedImage { id, image_path: dest_str })
        }
        "movie_cover" => {
            let code_upper = owner.to_uppercase();
            // Set as primary: clear others, update movies.cover_path
            conn.execute("UPDATE movie_covers SET is_primary = 0 WHERE code = ?1", params![code_upper])
                .map_err(|e| e.to_string())?;
            conn.execute("UPDATE movies SET cover_path = ?1, updated_at = datetime('now') WHERE code = ?2",
                params![dest_str, code_upper])
                .map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT INTO movie_covers (code, image_path, is_primary, source) VALUES (?1, ?2, 1, 'paste')",
                params![code_upper, dest_str],
            ).map_err(|e| e.to_string())?;
            let id = conn.last_insert_rowid();
            Ok(SavedImage { id, image_path: dest_str })
        }
        "actor_avatar" => {
            let actor_id: i64 = owner.parse().map_err(|_| "无效的演员ID".to_string())?;
            let old_path: Option<String> = conn.query_row(
                "SELECT avatar_path FROM actors WHERE id = ?1",
                params![actor_id],
                |row| row.get(0),
            ).ok().flatten();
            maybe_delete_unused_actor_avatar(&conn, &app_data, old_path);
            conn.execute("UPDATE actors SET avatar_path = ?1, updated_at = datetime('now') WHERE id = ?2",
                params![dest_str, actor_id])
                .map_err(|e| e.to_string())?;
            Ok(SavedImage { id: actor_id, image_path: dest_str })
        }
        _ => Err(format!("不支持的图片类型: {}", image_type)),
    }
}
