use rusqlite::params;
use tauri::State;

use crate::code_parser::normalize_for_storage;
use crate::db::Database;
use crate::models::{CloudFile, ProviderFileEntry};
use crate::providers::{FileProvider, config::ProviderConfig, local::LocalProvider, webdav::WebdavProvider};

#[tauri::command]
pub fn get_movie_files(db: State<Database>, code: String) -> Result<Vec<CloudFile>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, code, file_path, file_name, file_size, \
             provider, provider_file_id, provider_url, provider_meta \
             FROM files WHERE code = ?1 ORDER BY id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![normalize_for_storage(&code).canonical], |row| {
            Ok(CloudFile {
                id: row.get(0)?,
                code: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
                provider: row.get(5)?,
                provider_file_id: row.get(6)?,
                provider_url: row.get(7)?,
                provider_meta: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_movie_file(
    db: State<Database>,
    code: String,
    file_path: String,
    file_name: Option<String>,
    file_size: Option<i64>,
    provider: Option<String>,
    provider_file_id: Option<String>,
    provider_url: Option<String>,
    provider_meta: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let fname = file_name.unwrap_or_else(|| {
        std::path::Path::new(&file_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default()
    });
    let prov = provider.unwrap_or_else(|| "local".to_string());
    conn.execute(
        "INSERT OR IGNORE INTO files (code, file_path, file_name, file_size, provider, provider_file_id, provider_url, provider_meta) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![normalize_for_storage(&code).canonical, file_path, fname, file_size, prov, provider_file_id, provider_url, provider_meta],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_movie_file(db: State<Database>, file_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM files WHERE id = ?1", params![file_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_movie_actors(db: State<Database>, code: String) -> Result<Vec<crate::models::Actor>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.name, a.name_jp, a.measurements, a.birth_date, a.debut_year, \
             a.rating, a.comment, COALESCE(a.avatar_path, (SELECT ai.image_path FROM actor_images ai WHERE ai.actor_id = a.id ORDER BY ai.sort_order ASC, ai.id ASC LIMIT 1)), a.created_at, a.updated_at \
             FROM actors a INNER JOIN movie_actors ma ON a.id = ma.actor_id WHERE ma.code = ?1"
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![normalize_for_storage(&code).canonical], |row| {
            Ok(crate::models::Actor {
                id: row.get(0)?,
                name: row.get(1)?,
                name_jp: row.get(2)?,
                measurements: row.get(3)?,
                birth_date: row.get(4)?,
                debut_year: row.get(5)?,
                rating: row.get(6)?,
                comment: row.get(7)?,
                avatar_path: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_movie_actor(db: State<Database>, code: String, actor_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO movie_actors (code, actor_id) VALUES (?1, ?2)",
        params![normalize_for_storage(&code).canonical, actor_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_movie_actor(db: State<Database>, code: String, actor_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM movie_actors WHERE code = ?1 AND actor_id = ?2",
        params![normalize_for_storage(&code).canonical, actor_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Provider dispatch commands ──────────────────────────────────────────────

/// List files/directories under a given path using the named provider.
#[tauri::command]
pub fn provider_list(
    provider_name: String,
    path: String,
    // Provider-specific config
    root: Option<String>,
    endpoint: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<Vec<ProviderFileEntry>, String> {
    let provider = build_provider(&provider_name, root.as_deref(), endpoint.as_deref(), username.as_deref(), password.as_deref())?;
    provider.list(&path)
}

/// Search for files matching a movie code using the named provider.
#[tauri::command]
pub fn provider_search(
    provider_name: String,
    code: String,
    root: Option<String>,
    endpoint: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<Vec<ProviderFileEntry>, String> {
    let provider = build_provider(&provider_name, root.as_deref(), endpoint.as_deref(), username.as_deref(), password.as_deref())?;
    provider.search(&code)
}

/// Resolve a playback-ready URL for a file on a given provider.
#[tauri::command]
pub fn provider_resolve_url(
    provider_name: String,
    file_id: String,
    root: Option<String>,
    endpoint: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<String, String> {
    let provider = build_provider(&provider_name, root.as_deref(), endpoint.as_deref(), username.as_deref(), password.as_deref())?;
    provider.resolve_playback_url(&file_id)
}

fn build_provider(
    name: &str,
    root: Option<&str>,
    endpoint: Option<&str>,
    username: Option<&str>,
    password: Option<&str>,
) -> Result<Box<dyn FileProvider>, String> {
    match name {
        "local" => Ok(Box::new(LocalProvider::new(root.map(|s| s.to_string())))),
        "webdav" => {
            let ep = endpoint.ok_or_else(|| "WebDAV provider requires 'endpoint'".to_string())?;
            Ok(Box::new(WebdavProvider::new("webdav", ep, username, password)))
        }
        other => Err(format!("Unknown provider: {}", other)),
    }
}

// ── Provider config commands ────────────────────────────────────────────────

#[tauri::command]
pub fn list_provider_configs(db: State<Database>) -> Result<Vec<ProviderConfig>, String> {
    crate::providers::config::load_configs(&db.app_data_dir)
}

#[tauri::command]
pub fn save_provider_config(db: State<Database>, config: ProviderConfig) -> Result<(), String> {
    let mut configs = crate::providers::config::load_configs(&db.app_data_dir)?;
    if let Some(pos) = configs.iter().position(|c| c.id == config.id) {
        configs[pos] = config;
    } else {
        configs.push(config);
    }
    crate::providers::config::save_configs(&db.app_data_dir, &configs)
}

#[tauri::command]
pub fn delete_provider_config(db: State<Database>, id: String) -> Result<(), String> {
    let mut configs = crate::providers::config::load_configs(&db.app_data_dir)?;
    configs.retain(|c| c.id != id);
    crate::providers::config::save_configs(&db.app_data_dir, &configs)
}
