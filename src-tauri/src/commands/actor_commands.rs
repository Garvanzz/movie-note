use rusqlite::{params, Connection};
use tauri::State;

use crate::db::Database;
use crate::models::{Actor, ActorCategory, ActorName, ActorSuggestion, Tag};

#[tauri::command]
pub fn get_actor_categories(db: State<Database>) -> Result<Vec<ActorCategory>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, sort_order FROM actor_categories ORDER BY sort_order, name COLLATE NOCASE")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ActorCategory {
                id: row.get(0)?,
                name: row.get(1)?,
                sort_order: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_actor_category(db: State<Database>, name: String) -> Result<ActorCategory, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Category name cannot be empty".into());
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let next_sort_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM actor_categories",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO actor_categories (name, sort_order) VALUES (?1, ?2)",
        params![trimmed, next_sort_order],
    )
    .map_err(|e| e.to_string())?;

    Ok(ActorCategory {
        id: conn.last_insert_rowid(),
        name: trimmed.to_string(),
        sort_order: next_sort_order,
    })
}

#[tauri::command]
pub fn move_actor_category(db: State<Database>, id: i64, direction: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let (current_sort_order, target_id, target_sort_order): (i32, i64, i32) = {
        let current_sort_order: i32 = tx
            .query_row(
                "SELECT sort_order FROM actor_categories WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let query = match direction.as_str() {
            "up" => "SELECT id, sort_order FROM actor_categories WHERE sort_order < ?1 ORDER BY sort_order DESC, id DESC LIMIT 1",
            "down" => "SELECT id, sort_order FROM actor_categories WHERE sort_order > ?1 ORDER BY sort_order ASC, id ASC LIMIT 1",
            _ => return Err("Unsupported move direction".into()),
        };

        let neighbor = tx.query_row(query, params![current_sort_order], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i32>(1)?))
        });

        match neighbor {
            Ok((neighbor_id, neighbor_sort_order)) => (current_sort_order, neighbor_id, neighbor_sort_order),
            Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(()),
            Err(error) => return Err(error.to_string()),
        }
    };

    tx.execute(
        "UPDATE actor_categories SET sort_order = ?1 WHERE id = ?2",
        params![target_sort_order, id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE actor_categories SET sort_order = ?1 WHERE id = ?2",
        params![current_sort_order, target_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_actor_category(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM actor_categories WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_categories_for_actor(db: State<Database>, actor_id: i64) -> Result<Vec<ActorCategory>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT ac.id, ac.name, ac.sort_order FROM actor_categories ac \
             INNER JOIN actor_category_relations acr ON ac.id = acr.category_id \
             WHERE acr.actor_id = ?1 ORDER BY ac.sort_order, ac.name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![actor_id], |row| {
            Ok(ActorCategory {
                id: row.get(0)?,
                name: row.get(1)?,
                sort_order: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_actor_to_category(db: State<Database>, actor_id: i64, category_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO actor_category_relations (actor_id, category_id) VALUES (?1, ?2)",
        params![actor_id, category_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn add_actors_to_category(db: State<Database>, actor_ids: Vec<i64>, category_id: i64) -> Result<(), String> {
    if actor_ids.is_empty() {
        return Ok(());
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    {
        let mut stmt = tx
            .prepare("INSERT OR IGNORE INTO actor_category_relations (actor_id, category_id) VALUES (?1, ?2)")
            .map_err(|e| e.to_string())?;
        for actor_id in actor_ids {
            stmt.execute(params![actor_id, category_id])
                .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_actors_from_category(db: State<Database>, actor_ids: Vec<i64>, category_id: i64) -> Result<(), String> {
    if actor_ids.is_empty() {
        return Ok(());
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    {
        let mut stmt = tx
            .prepare("DELETE FROM actor_category_relations WHERE actor_id = ?1 AND category_id = ?2")
            .map_err(|e| e.to_string())?;
        for actor_id in actor_ids {
            stmt.execute(params![actor_id, category_id])
                .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_actor_from_category(db: State<Database>, actor_id: i64, category_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM actor_category_relations WHERE actor_id = ?1 AND category_id = ?2",
        params![actor_id, category_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_actors(
    db: State<Database>,
    search: Option<String>,
    category_id: Option<i64>,
    page: u32,
    page_size: u32,
) -> Result<crate::models::PaginatedResult<Actor>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if let Some(ref query) = search {
        let mut matched = search_actors_impl(&conn, query)?;
        if let Some(cid) = category_id {
            let mut stmt = conn
                .prepare("SELECT actor_id FROM actor_category_relations WHERE category_id = ?1")
                .map_err(|e| e.to_string())?;
            let actor_ids = stmt
                .query_map(params![cid], |row| row.get::<_, i64>(0))
                .map_err(|e| e.to_string())?
                .collect::<Result<std::collections::HashSet<_>, _>>()
                .map_err(|e| e.to_string())?;
            matched.retain(|entry| actor_ids.contains(&entry.actor.id));
        }
        let total = matched.len() as u64;
        let start = ((page.max(1) - 1) * page_size) as usize;
        let end = (start + page_size as usize).min(matched.len());
        let items = if start >= matched.len() {
            Vec::new()
        } else {
            matched[start..end].iter().map(|entry| entry.actor.clone()).collect()
        };

        return Ok(crate::models::PaginatedResult {
            items,
            total,
            page,
            page_size,
        });
    }

    let mut conditions = Vec::new();
    let mut params: Vec<String> = Vec::new();

    if let Some(cid) = category_id {
        conditions.push(format!(
            "a.id IN (SELECT actor_id FROM actor_category_relations WHERE category_id = ?{})",
            params.len() + 1
        ));
        params.push(cid.to_string());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM actors a {}", where_clause);
    let total: u64 = {
        let mut stmt = conn.prepare(&count_sql).map_err(|e| e.to_string())?;
        let pref: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();
        stmt.query_row(pref.as_slice(), |r| r.get::<_, i64>(0)).map_err(|e| e.to_string())? as u64
    };

    let offset = ((page.max(1) - 1) * page_size) as i64;
    let limit = page_size as i64;
    let query_sql = format!(
        "SELECT a.id, a.name, a.name_jp, a.measurements, a.birth_date, a.debut_year, \
         a.rating, a.comment, COALESCE(a.avatar_path, (SELECT ai.image_path FROM actor_images ai WHERE ai.actor_id = a.id ORDER BY ai.sort_order ASC, ai.id ASC LIMIT 1)), a.created_at, a.updated_at FROM actors a \
         {} ORDER BY a.name COLLATE NOCASE LIMIT ?{} OFFSET ?{}",
        where_clause, params.len() + 1, params.len() + 2
    );

    params.push(limit.to_string());
    params.push(offset.to_string());
    let pref: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();

    let mut stmt = conn.prepare(&query_sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(pref.as_slice(), |row| build_actor_from_row(row)).map_err(|e| e.to_string())?;
    let items = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    Ok(crate::models::PaginatedResult { items, total, page, page_size })
}

#[tauri::command]
pub fn suggest_actors(
    db: State<Database>,
    query: String,
    limit: u32,
) -> Result<Vec<ActorSuggestion>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut matched = search_actors_impl(&conn, &query)?;
    matched.truncate(limit.max(1) as usize);

    Ok(matched
        .into_iter()
        .map(|entry| ActorSuggestion {
            id: entry.actor.id,
            name: entry.actor.name,
            name_jp: entry.actor.name_jp,
            matched_name: entry.matched_name,
            match_kind: entry.match_kind,
        })
        .collect())
}

#[tauri::command]
pub fn get_actor(db: State<Database>, id: i64) -> Result<Actor, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, name, name_jp, measurements, birth_date, debut_year, \
         rating, comment, COALESCE(avatar_path, (SELECT ai.image_path FROM actor_images ai WHERE ai.actor_id = actors.id ORDER BY ai.sort_order ASC, ai.id ASC LIMIT 1)), created_at, updated_at FROM actors WHERE id = ?1",
        params![id],
        |row| build_actor_from_row(row),
    ).map_err(|e| format!("Actor not found: {}", e))
}

#[tauri::command]
pub fn get_actor_aliases(db: State<Database>, actor_id: i64) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    ensure_actor_names_seeded(&conn, actor_id)?;
    let mut stmt = conn
        .prepare(
            "SELECT name FROM actor_names WHERE actor_id = ?1 AND is_primary = 0 ORDER BY sort_order ASC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let aliases = stmt
        .query_map(params![actor_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(aliases)
}

#[tauri::command]
pub fn add_actor_alias(db: State<Database>, actor_id: i64, alias: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    add_actor_name_impl(&conn, actor_id, alias, "alias".to_string(), false).map(|_| ())
}

#[tauri::command]
pub fn remove_actor_alias(db: State<Database>, actor_id: i64, alias: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    ensure_actor_names_seeded(&conn, actor_id)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM actor_names WHERE actor_id = ?1 AND name = ?2 AND is_primary = 0",
        params![actor_id, alias.trim()],
    )
    .map_err(|e| e.to_string())?;
    sync_actor_name_cache(&tx, actor_id)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_actor_names(db: State<Database>, actor_id: i64) -> Result<Vec<ActorName>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    ensure_actor_names_seeded(&conn, actor_id)?;
    list_actor_names(&conn, actor_id)
}

#[tauri::command]
pub fn add_actor_name(
    db: State<Database>,
    actor_id: i64,
    name: String,
    kind: String,
    is_primary: bool,
) -> Result<ActorName, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    add_actor_name_impl(&conn, actor_id, name, kind, is_primary)
}

#[tauri::command]
pub fn update_actor_name(
    db: State<Database>,
    id: i64,
    name: String,
    kind: String,
    is_primary: bool,
) -> Result<ActorName, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Actor name cannot be empty".into());
    }

    let normalized_kind = normalize_actor_name_kind(&kind)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let actor_id: i64 = tx
        .query_row("SELECT actor_id FROM actor_names WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|e| format!("Actor name not found: {}", e))?;

    ensure_actor_names_seeded(&tx, actor_id)?;
    tx.execute(
        "UPDATE actor_names SET name = ?2, kind = ?3 WHERE id = ?1",
        params![id, trimmed, normalized_kind],
    )
    .map_err(|e| e.to_string())?;

    if is_primary {
        tx.execute(
            "UPDATE actor_names SET is_primary = CASE WHEN id = ?2 THEN 1 ELSE 0 END WHERE actor_id = ?1",
            params![actor_id, id],
        )
        .map_err(|e| e.to_string())?;
    }

    sync_actor_name_cache(&tx, actor_id)?;
    let updated = get_actor_name_by_id(&tx, id)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(updated)
}

#[tauri::command]
pub fn remove_actor_name(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let actor_id: i64 = tx
        .query_row("SELECT actor_id FROM actor_names WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|e| format!("Actor name not found: {}", e))?;

    ensure_actor_names_seeded(&tx, actor_id)?;
    let name_count: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM actor_names WHERE actor_id = ?1",
            params![actor_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if name_count <= 1 {
        return Err("至少需要保留一个姓名".into());
    }

    tx.execute("DELETE FROM actor_names WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    sync_actor_name_cache(&tx, actor_id)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_actor(db: State<Database>, name: String) -> Result<Actor, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Actor name cannot be empty".into());
    }

    let id = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO actors (name) VALUES (?1)", params![trimmed])
            .map_err(|e| e.to_string())?;
        let id = conn.last_insert_rowid();
        ensure_actor_names_seeded(&conn, id)?;
        sync_actor_name_cache(&conn, id)?;
        id
    };
    get_actor(db, id)
}

#[tauri::command]
pub fn update_actor(
    db: State<Database>, id: i64, name: Option<String>, name_jp: Option<String>,
    measurements: Option<String>, birth_date: Option<String>, debut_year: Option<i32>,
    rating: Option<f64>, comment: Option<String>,
) -> Result<(), String> {
    let normalized_name = match name {
        Some(value) => {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() {
                return Err("Actor name cannot be empty".into());
            }
            Some(trimmed)
        }
        None => None,
    };
    let normalized_name_jp = name_jp.map(|value| value.trim().to_string());
    let normalized_measurements = measurements.map(|value| value.trim().to_string());
    let normalized_birth_date = birth_date.map(|value| value.trim().to_string());
    let normalized_comment = comment.map(|value| value.trim().to_string());

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    ensure_actor_names_seeded(&tx, id)?;

    if let Some(name) = normalized_name {
        if let Ok(primary_id) = tx.query_row(
            "SELECT id FROM actor_names WHERE actor_id = ?1 AND is_primary = 1 ORDER BY sort_order ASC, id ASC LIMIT 1",
            params![id],
            |row| row.get::<_, i64>(0),
        ) {
            tx.execute("UPDATE actor_names SET name = ?2 WHERE id = ?1", params![primary_id, name])
                .map_err(|e| e.to_string())?;
        } else {
            tx.execute(
                "INSERT INTO actor_names (actor_id, name, kind, is_primary, sort_order) VALUES (?1, ?2, 'native', 1, 0)",
                params![id, name],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    if let Some(name_jp) = normalized_name_jp {
        if name_jp.is_empty() {
            tx.execute(
                "DELETE FROM actor_names WHERE actor_id = ?1 AND kind = 'japanese' AND is_primary = 0",
                params![id],
            )
            .map_err(|e| e.to_string())?;
        } else if let Ok(japanese_id) = tx.query_row(
            "SELECT id FROM actor_names WHERE actor_id = ?1 AND kind = 'japanese' ORDER BY is_primary DESC, sort_order ASC, id ASC LIMIT 1",
            params![id],
            |row| row.get::<_, i64>(0),
        ) {
            tx.execute(
                "UPDATE actor_names SET name = ?2, kind = 'japanese' WHERE id = ?1",
                params![japanese_id, name_jp],
            )
            .map_err(|e| e.to_string())?;
        } else {
            let next_sort_order: i32 = tx
                .query_row(
                    "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM actor_names WHERE actor_id = ?1",
                    params![id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            tx.execute(
                "INSERT INTO actor_names (actor_id, name, kind, is_primary, sort_order) VALUES (?1, ?2, 'japanese', 0, ?3)",
                params![id, name_jp, next_sort_order],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    tx.execute(
        "UPDATE actors SET \
         measurements=CASE WHEN ?2 IS NULL THEN measurements ELSE NULLIF(?2, '') END, \
         birth_date=CASE WHEN ?3 IS NULL THEN birth_date ELSE NULLIF(?3, '') END, \
         debut_year=COALESCE(?4,debut_year), rating=COALESCE(?5,rating), \
         comment=CASE WHEN ?6 IS NULL THEN comment ELSE NULLIF(?6, '') END, updated_at=datetime('now') WHERE id=?1",
        params![id, normalized_measurements, normalized_birth_date, debut_year, rating, normalized_comment],
    ).map_err(|e| e.to_string())?;
    sync_actor_name_cache(&tx, id)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_actor(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM actors WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn merge_actors(db: State<Database>, source_actor_id: i64, target_actor_id: i64) -> Result<Actor, String> {
    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        merge_actors_impl(&conn, source_actor_id, target_actor_id)?;
    }

    get_actor(db, target_actor_id)
}

#[tauri::command]
pub fn get_actor_tags(db: State<Database>, actor_id: i64) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.description, t.scope FROM tags t \
             INNER JOIN actor_tags at ON t.id = at.tag_id WHERE at.actor_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![actor_id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                scope: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(items)
}

#[tauri::command]
pub fn add_actor_tag(db: State<Database>, actor_id: i64, tag_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let is_actor_visible: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM tags WHERE id = ?1 AND scope IN ('actor', 'both'))",
        params![tag_id],
        |row| row.get::<_, i32>(0),
    )
    .map(|value| value != 0)
    .map_err(|e| e.to_string())?;

    if !is_actor_visible {
        return Err("该标签不适用于演员".to_string());
    }

    conn.execute(
        "INSERT OR IGNORE INTO actor_tags (actor_id, tag_id) VALUES (?1, ?2)",
        params![actor_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_actor_tag(db: State<Database>, actor_id: i64, tag_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM actor_tags WHERE actor_id = ?1 AND tag_id = ?2",
        params![actor_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Clone)]
struct ActorSearchMatch {
    actor: Actor,
    matched_name: String,
    match_kind: String,
    score: u8,
}

fn build_actor_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Actor> {
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
}

fn build_actor_name_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ActorName> {
    Ok(ActorName {
        id: row.get(0)?,
        actor_id: row.get(1)?,
        name: row.get(2)?,
        kind: row.get(3)?,
        is_primary: row.get::<_, i32>(4)? != 0,
        sort_order: row.get(5)?,
    })
}

fn normalize_actor_name_kind(kind: &str) -> Result<String, String> {
    let normalized = kind.trim().to_lowercase();
    match normalized.as_str() {
        "native" | "japanese" | "romanized" | "translated" | "stage" | "alias" => Ok(normalized),
        _ => Err("Unsupported actor name kind".into()),
    }
}

fn list_actor_names(conn: &Connection, actor_id: i64) -> Result<Vec<ActorName>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, actor_id, name, kind, is_primary, sort_order FROM actor_names \
             WHERE actor_id = ?1 ORDER BY is_primary DESC, sort_order ASC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![actor_id], |row| build_actor_name_from_row(row))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn get_actor_name_by_id(conn: &Connection, id: i64) -> Result<ActorName, String> {
    conn.query_row(
        "SELECT id, actor_id, name, kind, is_primary, sort_order FROM actor_names WHERE id = ?1",
        params![id],
        |row| build_actor_name_from_row(row),
    )
    .map_err(|e| format!("Actor name not found: {}", e))
}

fn ensure_actor_names_seeded(conn: &Connection, actor_id: i64) -> Result<(), String> {
    let existing_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM actor_names WHERE actor_id = ?1",
            params![actor_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if existing_count > 0 {
        return Ok(());
    }

    let (name, name_jp): (String, Option<String>) = conn
        .query_row(
            "SELECT name, name_jp FROM actors WHERE id = ?1",
            params![actor_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Actor not found: {}", e))?;

    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Actor must have at least one name".into());
    }

    conn.execute(
        "INSERT OR IGNORE INTO actor_names (actor_id, name, kind, is_primary, sort_order) VALUES (?1, ?2, 'native', 1, 0)",
        params![actor_id, trimmed_name],
    )
    .map_err(|e| e.to_string())?;

    if let Some(name_jp) = name_jp.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        if !name_jp.eq_ignore_ascii_case(trimmed_name) {
            conn.execute(
                "INSERT OR IGNORE INTO actor_names (actor_id, name, kind, is_primary, sort_order) VALUES (?1, ?2, 'japanese', 0, 1)",
                params![actor_id, name_jp],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    let mut stmt = conn
        .prepare("SELECT alias FROM actor_aliases WHERE actor_id = ?1 ORDER BY id ASC")
        .map_err(|e| e.to_string())?;
    let aliases = stmt
        .query_map(params![actor_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut sort_order = 10;
    for alias in aliases {
        let trimmed_alias = alias.trim();
        if trimmed_alias.is_empty() {
            continue;
        }

        conn.execute(
            "INSERT OR IGNORE INTO actor_names (actor_id, name, kind, is_primary, sort_order) VALUES (?1, ?2, 'alias', 0, ?3)",
            params![actor_id, trimmed_alias, sort_order],
        )
        .map_err(|e| e.to_string())?;
        sort_order += 1;
    }

    Ok(())
}

fn sync_actor_name_cache(conn: &Connection, actor_id: i64) -> Result<(), String> {
    ensure_actor_names_seeded(conn, actor_id)?;
    let names = list_actor_names(conn, actor_id)?;
    if names.is_empty() {
        return Err("Actor must have at least one name".into());
    }

    let primary_name_id = names.iter().find(|item| item.is_primary).map(|item| item.id).unwrap_or(names[0].id);
    conn.execute(
        "UPDATE actor_names SET is_primary = CASE WHEN id = ?2 THEN 1 ELSE 0 END WHERE actor_id = ?1",
        params![actor_id, primary_name_id],
    )
    .map_err(|e| e.to_string())?;

    let names = list_actor_names(conn, actor_id)?;
    let primary_name = names.iter().find(|item| item.is_primary).unwrap_or(&names[0]);
    let japanese_name = names
        .iter()
        .find(|item| item.kind == "japanese")
        .map(|item| item.name.clone());

    conn.execute(
        "UPDATE actors SET name = ?2, name_jp = ?3, updated_at = datetime('now') WHERE id = ?1",
        params![actor_id, primary_name.name, japanese_name],
    )
    .map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM actor_aliases WHERE actor_id = ?1", params![actor_id])
        .map_err(|e| e.to_string())?;
    for item in names.iter().filter(|item| item.id != primary_name.id) {
        conn.execute(
            "INSERT OR IGNORE INTO actor_aliases (actor_id, alias) VALUES (?1, ?2)",
            params![actor_id, item.name],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn add_actor_name_impl(
    conn: &Connection,
    actor_id: i64,
    name: String,
    kind: String,
    is_primary: bool,
) -> Result<ActorName, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Actor name cannot be empty".into());
    }
    let normalized_kind = normalize_actor_name_kind(&kind)?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    ensure_actor_names_seeded(&tx, actor_id)?;
    let existing_count: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM actor_names WHERE actor_id = ?1",
            params![actor_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let next_sort_order: i32 = tx
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM actor_names WHERE actor_id = ?1",
            params![actor_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO actor_names (actor_id, name, kind, is_primary, sort_order) VALUES (?1, ?2, ?3, 0, ?4)",
        params![actor_id, trimmed, normalized_kind, next_sort_order],
    )
    .map_err(|e| e.to_string())?;
    let id = tx.last_insert_rowid();

    if is_primary || existing_count == 0 {
        tx.execute(
            "UPDATE actor_names SET is_primary = CASE WHEN id = ?2 THEN 1 ELSE 0 END WHERE actor_id = ?1",
            params![actor_id, id],
        )
        .map_err(|e| e.to_string())?;
    }

    sync_actor_name_cache(&tx, actor_id)?;
    let created = get_actor_name_by_id(&tx, id)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(created)
}

fn merge_actors_impl(conn: &Connection, source_actor_id: i64, target_actor_id: i64) -> Result<(), String> {
    if source_actor_id == target_actor_id {
        return Err("不能合并同一个演员".into());
    }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    ensure_actor_names_seeded(&tx, source_actor_id)?;
    ensure_actor_names_seeded(&tx, target_actor_id)?;

    let select_actor_sql = "SELECT id, name, name_jp, measurements, birth_date, debut_year, \
         rating, comment, COALESCE(avatar_path, (SELECT ai.image_path FROM actor_images ai WHERE ai.actor_id = actors.id ORDER BY ai.sort_order ASC, ai.id ASC LIMIT 1)), created_at, updated_at FROM actors WHERE id = ?1";

    let source = tx
        .query_row(select_actor_sql, params![source_actor_id], |row| build_actor_from_row(row))
        .map_err(|e| format!("Source actor not found: {}", e))?;
    let _target = tx
        .query_row(select_actor_sql, params![target_actor_id], |row| build_actor_from_row(row))
        .map_err(|e| format!("Target actor not found: {}", e))?;

    tx.execute(
        "INSERT OR IGNORE INTO movie_actors (code, actor_id) SELECT code, ?2 FROM movie_actors WHERE actor_id = ?1",
        params![source_actor_id, target_actor_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR IGNORE INTO actor_category_relations (actor_id, category_id) SELECT ?2, category_id FROM actor_category_relations WHERE actor_id = ?1",
        params![source_actor_id, target_actor_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR IGNORE INTO actor_tags (actor_id, tag_id) SELECT ?2, tag_id FROM actor_tags WHERE actor_id = ?1",
        params![source_actor_id, target_actor_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR IGNORE INTO actor_names (actor_id, name, kind, is_primary, sort_order) \
         SELECT ?2, name, kind, 0, sort_order FROM actor_names WHERE actor_id = ?1",
        params![source_actor_id, target_actor_id],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE actor_images SET actor_id = ?2 WHERE actor_id = ?1",
        params![source_actor_id, target_actor_id],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE actors SET \
         name_jp = CASE WHEN name_jp IS NULL OR trim(name_jp) = '' THEN NULLIF(?2, '') ELSE name_jp END, \
         measurements = CASE WHEN measurements IS NULL OR trim(measurements) = '' THEN NULLIF(?3, '') ELSE measurements END, \
         birth_date = CASE WHEN birth_date IS NULL OR trim(birth_date) = '' THEN NULLIF(?4, '') ELSE birth_date END, \
         debut_year = COALESCE(debut_year, ?5), \
         rating = COALESCE(rating, ?6), \
         comment = CASE WHEN comment IS NULL OR trim(comment) = '' THEN NULLIF(?7, '') ELSE comment END, \
         avatar_path = CASE WHEN avatar_path IS NULL OR trim(avatar_path) = '' THEN NULLIF(?8, '') ELSE avatar_path END, \
         updated_at = datetime('now') \
         WHERE id = ?1",
        params![
            target_actor_id,
            source.name_jp.clone().unwrap_or_default(),
            source.measurements.clone().unwrap_or_default(),
            source.birth_date.clone().unwrap_or_default(),
            source.debut_year,
            source.rating,
            source.comment.clone().unwrap_or_default(),
            source.avatar_path.clone().unwrap_or_default(),
        ],
    )
    .map_err(|e| e.to_string())?;

    sync_actor_name_cache(&tx, target_actor_id)?;

    tx.execute("DELETE FROM actors WHERE id = ?1", params![source_actor_id])
        .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn search_actors_impl(conn: &Connection, query: &str) -> Result<Vec<ActorSearchMatch>, String> {
    let normalized = query.trim().to_lowercase();
    if normalized.is_empty() {
        return Ok(Vec::new());
    }

    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.name, a.name_jp, a.measurements, a.birth_date, a.debut_year, \
             a.rating, a.comment, COALESCE(a.avatar_path, (SELECT ai.image_path FROM actor_images ai WHERE ai.actor_id = a.id ORDER BY ai.sort_order ASC, ai.id ASC LIMIT 1)), a.created_at, a.updated_at, aa.alias \
             FROM actors a LEFT JOIN actor_aliases aa ON aa.actor_id = a.id \
             WHERE lower(a.name) LIKE ?1 OR lower(COALESCE(a.name_jp, '')) LIKE ?1 \
             OR lower(COALESCE(aa.alias, '')) LIKE ?1 \
             ORDER BY a.updated_at DESC, a.name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![format!("%{}%", normalized)], |row| {
            Ok((build_actor_from_row(row)?, row.get::<_, Option<String>>(11)?))
        })
        .map_err(|e| e.to_string())?;

    let mut best_matches = std::collections::HashMap::<i64, ActorSearchMatch>::new();
    for row in rows {
        let (actor, alias) = row.map_err(|e| e.to_string())?;
        let Some((score, matched_name, match_kind)) = best_actor_match(&actor, alias.as_deref(), &normalized) else {
            continue;
        };

        let entry = ActorSearchMatch {
            actor: actor.clone(),
            matched_name,
            match_kind,
            score,
        };

        match best_matches.get(&actor.id) {
            Some(existing) if existing.score <= entry.score => {}
            _ => {
                best_matches.insert(actor.id, entry);
            }
        }
    }

    let mut items = best_matches.into_values().collect::<Vec<_>>();
    items.sort_by(|left, right| {
        left.score
            .cmp(&right.score)
            .then_with(|| left.actor.name.cmp(&right.actor.name))
    });
    Ok(items)
}

fn best_actor_match(actor: &Actor, alias: Option<&str>, query: &str) -> Option<(u8, String, String)> {
    let mut best: Option<(u8, String, String)> = None;

    for (value, base_kind, field_priority) in [
        (Some(actor.name.as_str()), "name", 0_u8),
        (actor.name_jp.as_deref(), "name_jp", 1_u8),
        (alias, "alias", 2_u8),
    ] {
        let Some(value) = value else { continue };
        let normalized_value = value.trim().to_lowercase();
        let candidate = if normalized_value == query {
            Some((field_priority, value.to_string(), format!("{}_exact", base_kind)))
        } else if normalized_value.starts_with(query) {
            Some((3 + field_priority, value.to_string(), format!("{}_prefix", base_kind)))
        } else if normalized_value.contains(query) {
            Some((6 + field_priority, value.to_string(), format!("{}_contains", base_kind)))
        } else {
            None
        };

        if let Some(candidate) = candidate {
            match &best {
                Some(existing) if existing.0 <= candidate.0 => {}
                _ => best = Some(candidate),
            }
        }
    }

    best
}

#[cfg(test)]
mod tests {
    use super::{merge_actors_impl, search_actors_impl};
    use crate::db::migrations::get_migrations;
    use rusqlite::{params, Connection};

    fn setup_connection() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        for migration in get_migrations() {
            conn.execute_batch(migration.sql).expect("apply migration");
        }
        conn
    }

    #[test]
    fn actor_search_prefers_primary_name_over_alias_when_scores_tie() {
        let conn = setup_connection();
        conn.execute("INSERT INTO actors (id, name) VALUES (1, 'Yua Aida')", [])
            .expect("insert first actor");
        conn.execute("INSERT INTO actors (id, name) VALUES (2, 'Mikami Yua')", [])
            .expect("insert second actor");
        conn.execute(
            "INSERT INTO actor_aliases (actor_id, alias) VALUES (2, 'Yua Mikami')",
            [],
        )
        .expect("insert actor alias");

        let results = search_actors_impl(&conn, "yua").expect("search actors");

        assert_eq!(results[0].actor.name, "Yua Aida");
        assert_eq!(results[0].match_kind, "name_prefix");
        assert_eq!(results[1].actor.name, "Mikami Yua");
        assert_eq!(results[1].match_kind, "alias_prefix");
    }

    #[test]
    fn actor_search_uses_alias_exact_matches() {
        let conn = setup_connection();
        conn.execute("INSERT INTO actors (id, name, name_jp) VALUES (1, 'Mikami Yua', '三上悠亜')", [])
            .expect("insert actor");
        conn.execute(
            "INSERT INTO actor_aliases (actor_id, alias) VALUES (1, 'Yua Mikami')",
            [],
        )
        .expect("insert alias");

        let results = search_actors_impl(&conn, "yua mikami").expect("search actors");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].matched_name, "Yua Mikami");
        assert_eq!(results[0].match_kind, "alias_exact");
    }

    #[test]
    fn actor_aliases_round_trip_in_order() {
        let conn = setup_connection();
        conn.execute("INSERT INTO actors (id, name) VALUES (1, 'Mikami Yua')", [])
            .expect("insert actor");
        conn.execute(
            "INSERT INTO actor_aliases (actor_id, alias) VALUES (1, 'Yua Mikami'), (1, '三上悠亚')",
            [],
        )
        .expect("insert aliases");

        let mut stmt = conn
            .prepare("SELECT alias FROM actor_aliases WHERE actor_id = ?1 ORDER BY alias COLLATE NOCASE")
            .expect("prepare alias query");
        let aliases = stmt
            .query_map(params![1_i64], |row| row.get::<_, String>(0))
            .expect("query aliases")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect aliases");

        assert_eq!(aliases, vec!["Yua Mikami", "三上悠亚"]);
    }

    #[test]
    fn merge_actors_moves_relations_and_preserves_aliases() {
        let conn = setup_connection();
        conn.execute(
            "INSERT INTO tags (id, name, scope) VALUES (1, 'Popular', 'both')",
            [],
        )
        .expect("insert tag");
        conn.execute(
            "INSERT INTO actor_categories (id, name, sort_order) VALUES (1, 'Legend', 0)",
            [],
        )
        .expect("insert category");
        conn.execute(
            "INSERT INTO actors (id, name, name_jp, avatar_path) VALUES (1, 'Mikami Yua', '三上悠亜', NULL), (2, 'Yua Mikami', NULL, 'source-avatar.jpg')",
            [],
        )
        .expect("insert actors");
        conn.execute(
            "INSERT INTO movies (code, code_norm) VALUES ('IPX-001', 'IPX001')",
            [],
        )
        .expect("insert movie");
        conn.execute(
            "INSERT INTO actor_aliases (actor_id, alias) VALUES (2, '三上悠亚')",
            [],
        )
        .expect("insert alias");
        conn.execute(
            "INSERT INTO movie_actors (code, actor_id) VALUES ('IPX-001', 2)",
            [],
        )
        .expect("insert movie relation");
        conn.execute(
            "INSERT INTO actor_category_relations (actor_id, category_id) VALUES (2, 1)",
            [],
        )
        .expect("insert category relation");
        conn.execute(
            "INSERT INTO actor_tags (actor_id, tag_id) VALUES (2, 1)",
            [],
        )
        .expect("insert actor tag");
        conn.execute(
            "INSERT INTO actor_images (actor_id, image_path, sort_order) VALUES (2, 'gallery-image.jpg', 0)",
            [],
        )
        .expect("insert actor image");

        merge_actors_impl(&conn, 2, 1).expect("merge actors");

        let movie_actor_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM movie_actors WHERE code = 'IPX-001' AND actor_id = 1",
                [],
                |row| row.get(0),
            )
            .expect("movie actor count");
        let category_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM actor_category_relations WHERE actor_id = 1 AND category_id = 1",
                [],
                |row| row.get(0),
            )
            .expect("category count");
        let image_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM actor_images WHERE actor_id = 1 AND image_path = 'gallery-image.jpg'",
                [],
                |row| row.get(0),
            )
            .expect("image count");
        let source_exists: i64 = conn
            .query_row("SELECT COUNT(*) FROM actors WHERE id = 2", [], |row| row.get(0))
            .expect("source exists");
        let merged_avatar: String = conn
            .query_row("SELECT avatar_path FROM actors WHERE id = 1", [], |row| row.get(0))
            .expect("merged avatar");

        let mut stmt = conn
            .prepare("SELECT alias FROM actor_aliases WHERE actor_id = 1 ORDER BY alias COLLATE NOCASE")
            .expect("prepare aliases");
        let aliases = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .expect("query aliases")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect aliases");

        assert_eq!(movie_actor_count, 1);
        assert_eq!(category_count, 1);
        assert_eq!(image_count, 1);
        assert_eq!(source_exists, 0);
        assert_eq!(merged_avatar, "source-avatar.jpg");
        assert!(aliases.contains(&"Yua Mikami".to_string()));
        assert!(aliases.contains(&"三上悠亚".to_string()));
    }
}
