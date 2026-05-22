use rusqlite::params;
use tauri::State;

use crate::code_parser::normalize_for_storage;
use crate::db::Database;
use crate::models::{CloudFile, ProviderFileEntry};
use crate::providers::{FileProvider, config::ProviderConfig, local::LocalProvider, open115::Open115Provider, webdav::WebdavProvider};

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
    db: State<Database>,
    provider_name: String,
    path: String,
    // Provider-specific config
    root: Option<String>,
    endpoint: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<Vec<ProviderFileEntry>, String> {
    let provider = build_provider(&provider_name, root.as_deref(), endpoint.as_deref(), username.as_deref(), password.as_deref(), &db.app_data_dir)?;
    provider.list(&path)
}

/// Search for files matching a movie code using the named provider.
#[tauri::command]
pub fn provider_search(
    db: State<Database>,
    provider_name: String,
    code: String,
    root: Option<String>,
    endpoint: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<Vec<ProviderFileEntry>, String> {
    let provider = build_provider(&provider_name, root.as_deref(), endpoint.as_deref(), username.as_deref(), password.as_deref(), &db.app_data_dir)?;
    provider.search(&code)
}

/// Resolve a playback-ready URL for a file on a given provider.
#[tauri::command]
pub fn provider_resolve_url(
    db: State<Database>,
    provider_name: String,
    file_id: String,
    root: Option<String>,
    endpoint: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<String, String> {
    let provider = build_provider(&provider_name, root.as_deref(), endpoint.as_deref(), username.as_deref(), password.as_deref(), &db.app_data_dir)?;
    provider.resolve_playback_url(&file_id)
}

fn build_provider(
    name: &str,
    root: Option<&str>,
    endpoint: Option<&str>,
    username: Option<&str>,
    password: Option<&str>,
    app_data_dir: &std::path::PathBuf,
) -> Result<Box<dyn FileProvider>, String> {
    match name {
        "local" => Ok(Box::new(LocalProvider::new(root.map(|s| s.to_string())))),
        "webdav" => {
            let ep = endpoint.ok_or_else(|| "WebDAV provider requires 'endpoint'".to_string())?;
            Ok(Box::new(WebdavProvider::new("webdav", ep, username, password)))
        }
        "open115" => {
            let cid = endpoint.ok_or_else(|| "115Open provider requires 'client_id' as endpoint".to_string())?;
            Ok(Box::new(Open115Provider::new("open115", cid, app_data_dir.clone())))
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

// ── 115 Open OAuth commands ───────────────────────────────────────────────

#[tauri::command]
pub fn open115_start_auth(client_id: String) -> Result<crate::providers::open115::DeviceCodeData, String> {
    crate::providers::open115::Open115Provider::start_device_code(&client_id)
}

#[tauri::command]
pub fn open115_poll_status(uid: String, time: i64, sign: String) -> Result<crate::providers::open115::QrCodeStatusData, String> {
    crate::providers::open115::Open115Provider::poll_qrcode_status(&uid, time, &sign)
}

#[tauri::command]
pub fn open115_exchange_token(db: State<Database>, client_id: String, uid: String) -> Result<crate::providers::open115::TokenData, String> {
    crate::providers::open115::Open115Provider::exchange_token(&client_id, &uid, &db.app_data_dir)
}

#[tauri::command]
pub fn open115_get_user_info(db: State<Database>, client_id: String) -> Result<crate::providers::open115::UserInfo, String> {
    let provider = crate::providers::open115::Open115Provider::new("open115", &client_id, db.app_data_dir.clone());
    provider.get_user_info()
}

#[tauri::command]
pub fn open115_check_auth(db: State<Database>, client_id: String) -> Result<bool, String> {
    let provider = crate::providers::open115::Open115Provider::new("open115", &client_id, db.app_data_dir.clone());
    Ok(provider.is_authenticated())
}

#[tauri::command]
pub fn open115_logout(db: State<Database>) -> Result<(), String> {
    crate::providers::open115::delete_token(&db.app_data_dir)
}

// ── 115 Open file operations ──────────────────────────────────────────────

#[tauri::command]
pub fn open115_mkdir(db: State<Database>, client_id: String, pid: String, name: String) -> Result<String, String> {
    let provider = crate::providers::open115::Open115Provider::new("open115", &client_id, db.app_data_dir.clone());
    provider.mkdir(&pid, &name)
}

#[tauri::command]
pub fn open115_rename(db: State<Database>, client_id: String, file_id: String, new_name: String) -> Result<(), String> {
    let provider = crate::providers::open115::Open115Provider::new("open115", &client_id, db.app_data_dir.clone());
    provider.rename(&file_id, &new_name)
}

#[tauri::command]
pub fn open115_delete(db: State<Database>, client_id: String, file_ids: String, parent_id: String) -> Result<(), String> {
    let provider = crate::providers::open115::Open115Provider::new("open115", &client_id, db.app_data_dir.clone());
    provider.delete_files(&file_ids, &parent_id)
}

#[tauri::command]
pub fn open115_move(db: State<Database>, client_id: String, file_ids: String, to_cid: String) -> Result<(), String> {
    let provider = crate::providers::open115::Open115Provider::new("open115", &client_id, db.app_data_dir.clone());
    provider.move_files(&file_ids, &to_cid)
}

#[tauri::command]
pub fn open115_copy(db: State<Database>, client_id: String, file_ids: String, pid: String) -> Result<(), String> {
    let provider = crate::providers::open115::Open115Provider::new("open115", &client_id, db.app_data_dir.clone());
    provider.copy_files(&file_ids, &pid)
}

// ── 115 Open stat / recycle ───────────────────────────────────────────────

#[tauri::command]
pub fn open115_stat(db: State<Database>, client_id: String, file_id: String) -> Result<serde_json::Value, String> {
    let provider = crate::providers::open115::Open115Provider::new("open115", &client_id, db.app_data_dir.clone());
    provider.stat(&file_id)
}

#[tauri::command]
pub fn open115_rb_list(db: State<Database>, client_id: String, limit: i64, offset: i64) -> Result<serde_json::Value, String> {
    let provider = crate::providers::open115::Open115Provider::new("open115", &client_id, db.app_data_dir.clone());
    provider.rb_list(limit, offset)
}

#[tauri::command]
pub fn open115_rb_revert(db: State<Database>, client_id: String, tid: String) -> Result<(), String> {
    let provider = crate::providers::open115::Open115Provider::new("open115", &client_id, db.app_data_dir.clone());
    provider.rb_revert(&tid)
}

#[tauri::command]
pub fn open115_rb_delete(db: State<Database>, client_id: String, tid: String) -> Result<(), String> {
    let provider = crate::providers::open115::Open115Provider::new("open115", &client_id, db.app_data_dir.clone());
    provider.rb_delete(&tid)
}
