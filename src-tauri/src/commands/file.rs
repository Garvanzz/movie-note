use crate::db::Database;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudFile {
    pub id: i64,
    #[serde(rename = "code")]
    pub movie_code: String,
    pub file_path: String,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
}

#[tauri::command]
pub fn get_movie_files(db: State<Database>, code: String) -> Result<Vec<CloudFile>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, movie_code, file_path, file_name, file_size FROM files WHERE movie_code = ?",
        )
        .map_err(|e| e.to_string())?;
    let files = stmt
        .query_map(params![code], |row| {
            Ok(CloudFile {
                id: row.get(0)?,
                movie_code: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(files)
}

#[tauri::command]
pub fn add_movie_file(
    db: State<Database>,
    code: String,
    file_path: String,
    file_name: Option<String>,
    file_size: Option<i64>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let name = file_name.unwrap_or_else(|| {
        std::path::Path::new(&file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string()
    });
    conn.execute(
        "INSERT INTO files (movie_code, file_path, file_name, file_size) VALUES (?1, ?2, ?3, ?4)",
        params![code, file_path, name, file_size],
    )
    .map_err(|e| format!("Failed to add file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn remove_movie_file(db: State<Database>, file_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM files WHERE id = ?", params![file_id])
        .map_err(|e| format!("Failed to remove file: {}", e))?;
    Ok(())
}
