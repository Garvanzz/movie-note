use rusqlite::params;
use tauri::State;

use crate::db::Database;
use crate::models::CloudFile;

#[tauri::command]
pub fn get_movie_files(db: State<Database>, code: String) -> Result<Vec<CloudFile>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, code, file_path, file_name, file_size FROM files WHERE code = ?1 ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![code.to_uppercase()], |row| {
            Ok(CloudFile {
                id: row.get(0)?,
                code: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
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
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let fname = file_name.unwrap_or_else(|| {
        std::path::Path::new(&file_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default()
    });
    conn.execute(
        "INSERT OR IGNORE INTO files (code, file_path, file_name, file_size) VALUES (?1, ?2, ?3, ?4)",
        params![code.to_uppercase(), file_path, fname, file_size],
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
             a.rating, a.comment, a.avatar_path, a.created_at, a.updated_at \
             FROM actors a INNER JOIN movie_actors ma ON a.id = ma.actor_id WHERE ma.code = ?1"
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![code.to_uppercase()], |row| {
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
        params![code.to_uppercase(), actor_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_movie_actor(db: State<Database>, code: String, actor_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM movie_actors WHERE code = ?1 AND actor_id = ?2",
        params![code.to_uppercase(), actor_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
