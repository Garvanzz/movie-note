use rusqlite::params;
use tauri::State;
use crate::db::Database;
use crate::models::{Tag, TagGroup, Genre};

fn normalize_tag_scope(scope: &str) -> Result<&'static str, String> {
    match scope {
        "movie" => Ok("movie"),
        "actor" => Ok("actor"),
        "both" => Ok("both"),
        _ => Err(format!("无效的标签作用域: {}", scope)),
    }
}

fn merge_tag_scopes(existing: &str, requested: &str) -> &'static str {
    if existing == requested {
        return match existing {
            "movie" => "movie",
            "actor" => "actor",
            _ => "both",
        };
    }

    "both"
}

fn build_tag_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        scope: row.get(3)?,
    })
}

#[tauri::command]
pub fn get_tags(db: State<Database>, scope: Option<String>) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let (query, params_vec): (&str, Vec<&str>) = match scope.as_deref() {
        None => ("SELECT id, name, description, scope FROM tags ORDER BY name", Vec::new()),
        Some(raw_scope) => {
            let normalized_scope = normalize_tag_scope(raw_scope)?;
            match normalized_scope {
                "movie" => (
                    "SELECT id, name, description, scope FROM tags WHERE scope IN (?1, 'both') ORDER BY name",
                    vec!["movie"],
                ),
                "actor" => (
                    "SELECT id, name, description, scope FROM tags WHERE scope IN (?1, 'both') ORDER BY name",
                    vec!["actor"],
                ),
                _ => (
                    "SELECT id, name, description, scope FROM tags WHERE scope = ?1 ORDER BY name",
                    vec!["both"],
                ),
            }
        }
    };
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(rusqlite::params_from_iter(params_vec), build_tag_from_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_tag(db: State<Database>, name: String, scope: String) -> Result<Tag, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("标签名不能为空".to_string());
    }

    let normalized_scope = normalize_tag_scope(&scope)?;

    let existing = conn.query_row(
        "SELECT id, name, description, scope FROM tags WHERE name = ?1",
        params![trimmed_name],
        build_tag_from_row,
    );

    if let Ok(tag) = existing {
        let next_scope = merge_tag_scopes(&tag.scope, normalized_scope);
        if next_scope != tag.scope {
            conn.execute("UPDATE tags SET scope = ?1 WHERE id = ?2", params![next_scope, tag.id])
                .map_err(|e| e.to_string())?;
            return Ok(Tag {
                scope: next_scope.to_string(),
                ..tag
            });
        }

        return Ok(tag);
    }

    conn.execute("INSERT INTO tags (name, scope) VALUES (?1, ?2)", params![trimmed_name, normalized_scope])
        .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Tag {
        id,
        name: trimmed_name.to_string(),
        description: None,
        scope: normalized_scope.to_string(),
    })
}

#[tauri::command]
pub fn delete_tag(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_tag_groups(db: State<Database>) -> Result<Vec<TagGroup>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, description, sort_order FROM tag_groups ORDER BY sort_order")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(TagGroup {
        id: row.get(0)?, name: row.get(1)?, description: row.get(2)?, sort_order: row.get(3)?,
    })).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_tag_group(db: State<Database>, name: String) -> Result<TagGroup, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO tag_groups (name) VALUES (?1)", params![name])
        .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(TagGroup { id, name, description: None, sort_order: 0 })
}

#[tauri::command]
pub fn delete_tag_group(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tag_groups WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_genres(db: State<Database>) -> Result<Vec<Genre>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, description FROM genres ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(Genre { id: row.get(0)?, name: row.get(1)?, description: row.get(2)? }))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_genre(db: State<Database>, name: String) -> Result<Genre, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO genres (name) VALUES (?1)", params![name])
        .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Genre { id, name, description: None })
}

#[tauri::command]
pub fn delete_genre(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM genres WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// --- movie-genre junction ---

#[tauri::command]
pub fn get_movie_genres(db: State<Database>, code: String) -> Result<Vec<Genre>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT g.id, g.name, g.description FROM genres g \
             INNER JOIN movie_genres mg ON g.id = mg.genre_id WHERE mg.code = ?1",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![code.to_uppercase()], |row| {
            Ok(Genre {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(items)
}

#[tauri::command]
pub fn add_movie_genre(db: State<Database>, code: String, genre_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO movie_genres (code, genre_id) VALUES (?1, ?2)",
        params![code.to_uppercase(), genre_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_movie_genre(db: State<Database>, code: String, genre_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM movie_genres WHERE code = ?1 AND genre_id = ?2",
        params![code.to_uppercase(), genre_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// --- tag-group-items junction ---

#[tauri::command]
pub fn get_tag_group_items(db: State<Database>, group_id: i64) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.description, t.scope FROM tags t \
             INNER JOIN tag_group_items tgi ON t.id = tgi.tag_id \
             WHERE tgi.group_id = ?1 AND t.scope IN ('movie', 'both') ORDER BY tgi.sort_order",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![group_id], build_tag_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(items)
}

#[tauri::command]
pub fn add_tag_to_group(db: State<Database>, group_id: i64, tag_id: i64, sort_order: Option<i32>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let is_movie_visible: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM tags WHERE id = ?1 AND scope IN ('movie', 'both'))",
        params![tag_id],
        |row| row.get::<_, i32>(0),
    )
    .map(|value| value != 0)
    .map_err(|e| e.to_string())?;

    if !is_movie_visible {
        return Err("演员标签不能加入影片标签组".to_string());
    }

    conn.execute(
        "INSERT OR IGNORE INTO tag_group_items (group_id, tag_id, sort_order) VALUES (?1, ?2, ?3)",
        params![group_id, tag_id, sort_order.unwrap_or(0)],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_tag_from_group(db: State<Database>, group_id: i64, tag_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM tag_group_items WHERE group_id = ?1 AND tag_id = ?2",
        params![group_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
