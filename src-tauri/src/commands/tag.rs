use crate::db::Database;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagGroup {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Genre {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
}

#[tauri::command]
pub fn get_tags(db: State<Database>) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description FROM tags ORDER BY name")
        .map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(tags)
}

#[tauri::command]
pub fn create_tag(db: State<Database>, name: String) -> Result<Tag, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO tags (name) VALUES (?1)", params![name])
        .map_err(|e| format!("Failed to create tag: {}", e))?;
    let id = conn.last_insert_rowid();
    Ok(Tag {
        id,
        name,
        description: None,
    })
}

#[tauri::command]
pub fn delete_tag(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE id = ?", params![id])
        .map_err(|e| format!("Failed to delete tag: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_tag_groups(db: State<Database>) -> Result<Vec<TagGroup>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, sort_order FROM tag_groups ORDER BY sort_order, name")
        .map_err(|e| e.to_string())?;
    let groups = stmt
        .query_map([], |row| {
            Ok(TagGroup {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                sort_order: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(groups)
}

#[tauri::command]
pub fn create_tag_group(db: State<Database>, name: String) -> Result<TagGroup, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO tag_groups (name) VALUES (?1)",
        params![name],
    )
    .map_err(|e| format!("Failed to create tag group: {}", e))?;
    let id = conn.last_insert_rowid();
    Ok(TagGroup {
        id,
        name,
        description: None,
        sort_order: 0,
    })
}

#[tauri::command]
pub fn get_genres(db: State<Database>) -> Result<Vec<Genre>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description FROM genres ORDER BY name")
        .map_err(|e| e.to_string())?;
    let genres = stmt
        .query_map([], |row| {
            Ok(Genre {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(genres)
}

#[tauri::command]
pub fn create_genre(db: State<Database>, name: String) -> Result<Genre, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO genres (name) VALUES (?1)", params![name])
        .map_err(|e| format!("Failed to create genre: {}", e))?;
    let id = conn.last_insert_rowid();
    Ok(Genre {
        id,
        name,
        description: None,
    })
}

#[tauri::command]
pub fn delete_genre(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM genres WHERE id = ?", params![id])
        .map_err(|e| format!("Failed to delete genre: {}", e))?;
    Ok(())
}
