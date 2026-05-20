use rusqlite::{params, Connection};
use tauri::State;

use crate::db::Database;
use crate::models::{Actor, ActorCategory, ActorSuggestion, Tag};

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
         a.rating, a.comment, a.avatar_path, a.created_at, a.updated_at FROM actors a \
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
         rating, comment, avatar_path, created_at, updated_at FROM actors WHERE id = ?1",
        params![id],
        |row| build_actor_from_row(row),
    ).map_err(|e| format!("Actor not found: {}", e))
}

#[tauri::command]
pub fn get_actor_aliases(db: State<Database>, actor_id: i64) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT alias FROM actor_aliases WHERE actor_id = ?1 ORDER BY alias COLLATE NOCASE",
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
    let trimmed = alias.trim();
    if trimmed.is_empty() {
        return Err("Alias cannot be empty".into());
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO actor_aliases (actor_id, alias) VALUES (?1, ?2)",
        params![actor_id, trimmed],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_actor_alias(db: State<Database>, actor_id: i64, alias: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM actor_aliases WHERE actor_id = ?1 AND alias = ?2",
        params![actor_id, alias.trim()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_actor(db: State<Database>, name: String) -> Result<Actor, String> {
    let id = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO actors (name) VALUES (?1)", params![name])
            .map_err(|e| e.to_string())?;
        conn.last_insert_rowid()
    };
    get_actor(db, id)
}

#[tauri::command]
pub fn update_actor(
    db: State<Database>, id: i64, name: Option<String>, name_jp: Option<String>,
    measurements: Option<String>, birth_date: Option<String>, debut_year: Option<i32>,
    rating: Option<f64>, comment: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE actors SET name=COALESCE(?2,name), name_jp=COALESCE(?3,name_jp), \
         measurements=COALESCE(?4,measurements), birth_date=COALESCE(?5,birth_date), \
         debut_year=COALESCE(?6,debut_year), rating=COALESCE(?7,rating), \
         comment=COALESCE(?8,comment), updated_at=datetime('now') WHERE id=?1",
        params![id, name, name_jp, measurements, birth_date, debut_year, rating, comment],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_actor(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM actors WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
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

fn search_actors_impl(conn: &Connection, query: &str) -> Result<Vec<ActorSearchMatch>, String> {
    let normalized = query.trim().to_lowercase();
    if normalized.is_empty() {
        return Ok(Vec::new());
    }

    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.name, a.name_jp, a.measurements, a.birth_date, a.debut_year, \
             a.rating, a.comment, a.avatar_path, a.created_at, a.updated_at, aa.alias \
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
    use super::search_actors_impl;
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
}
