use crate::db::Database;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::PaginatedResult;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Actor {
    pub id: i64,
    pub name: String,
    pub name_jp: Option<String>,
    pub measurements: Option<String>,
    pub birth_date: Option<String>,
    pub debut_year: Option<i32>,
    pub rating: Option<f64>,
    pub comment: Option<String>,
    pub avatar_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_actors(
    db: State<Database>,
    search: Option<String>,
    category_id: Option<i64>,
    page: i64,
    page_size: i64,
) -> Result<PaginatedResult<Actor>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut where_clauses = vec!["1=1".to_string()];
    let mut params_list: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(ref s) = search {
        where_clauses.push("a.name LIKE ?".to_string());
        params_list.push(Box::new(format!("%{}%", s)));
    }

    if category_id.is_some() {
        where_clauses.push(
            "a.id IN (SELECT actor_id FROM movie_actors)".to_string(),
        );
    }

    let where_sql = where_clauses.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM actors a WHERE {}", where_sql);
    let total: i64 = {
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            params_list.iter().map(|p| p.as_ref()).collect();
        conn.query_row(&count_sql, params_refs.as_slice(), |row| row.get(0))
            .map_err(|e| e.to_string())?
    };

    let offset = (page - 1) * page_size;
    let query_sql = format!(
        "SELECT a.* FROM actors a WHERE {} ORDER BY a.name ASC LIMIT ? OFFSET ?",
        where_sql
    );
    params_list.push(Box::new(page_size));
    params_list.push(Box::new(offset));

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        params_list.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&query_sql).map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(Actor {
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
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(PaginatedResult {
        items,
        total,
        page,
        page_size,
    })
}

#[tauri::command]
pub fn get_actor(db: State<Database>, id: i64) -> Result<Actor, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row("SELECT * FROM actors WHERE id = ?", params![id], |row| {
        Ok(Actor {
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
    .map_err(|e| format!("Actor not found: {}", e))
}

#[tauri::command]
pub fn create_actor(db: State<Database>, name: String) -> Result<Actor, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO actors (name) VALUES (?1)", params![name])
        .map_err(|e| format!("Failed to create actor: {}", e))?;
    let id = conn.last_insert_rowid();
    drop(conn);
    get_actor(db, id)
}

#[tauri::command]
pub fn update_actor(
    db: State<Database>,
    id: i64,
    name: Option<String>,
    name_jp: Option<String>,
    measurements: Option<String>,
    birth_date: Option<String>,
    debut_year: Option<i32>,
    rating: Option<f64>,
    comment: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE actors SET
            name = COALESCE(?2, name),
            name_jp = COALESCE(?3, name_jp),
            measurements = COALESCE(?4, measurements),
            birth_date = COALESCE(?5, birth_date),
            debut_year = COALESCE(?6, debut_year),
            rating = COALESCE(?7, rating),
            comment = COALESCE(?8, comment),
            updated_at = datetime('now', 'localtime')
        WHERE id = ?1",
        params![
            id, name, name_jp, measurements, birth_date, debut_year, rating,
            comment
        ],
    )
    .map_err(|e| format!("Failed to update actor: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn delete_actor(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM actors WHERE id = ?", params![id])
        .map_err(|e| format!("Failed to delete actor: {}", e))?;
    Ok(())
}
