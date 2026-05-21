use rusqlite::{params, Connection};
use tauri::State;

use crate::code_parser::{extract_series, normalize, normalize_for_storage, normalize_no_sep, normalize_search_query};
use crate::db::Database;
use crate::models::{Movie, MovieFilter, MovieSuggestion, PaginatedResult};

#[tauri::command]
pub fn get_movies(
    db: State<Database>,
    filter: MovieFilter,
    page: u32,
    page_size: u32,
) -> Result<PaginatedResult<Movie>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut conditions = Vec::new();
    let mut param_values: Vec<String> = Vec::new();

    if let Some(ref search) = filter.search {
        let forms = normalize_search_query(search);
        let canonical = forms.canonical_guess.unwrap_or_else(|| normalize(search));
        let norm_no_sep = forms.code_norm_guess.unwrap_or_else(|| normalize_no_sep(search));
        conditions.push(
            "(m.code = ?1 OR m.code_norm = ?2 OR m.code LIKE ?3 OR m.code_norm LIKE ?4 OR m.title LIKE ?5)".into(),
        );
        param_values.push(canonical.clone());
        param_values.push(norm_no_sep.clone());
        param_values.push(format!("%{}%", canonical));
        param_values.push(format!("%{}%", norm_no_sep));
        param_values.push(format!("%{}%", search.trim()));
    }

    if let Some(ref tag_ids) = filter.tag_ids {
        if !tag_ids.is_empty() {
            let placeholders: Vec<String> = tag_ids.iter().enumerate()
                .map(|(i, _)| format!("?{}", param_values.len() + i + 1))
                .collect();
            conditions.push(format!(
                "m.code IN (SELECT code FROM movie_tags WHERE tag_id IN ({}))",
                placeholders.join(",")
            ));
            param_values.extend(tag_ids.iter().map(|v| v.to_string()));
        }
    }

    if let Some(ref actor_ids) = filter.actor_ids {
        if !actor_ids.is_empty() {
            let placeholders: Vec<String> = actor_ids.iter().enumerate()
                .map(|(i, _)| format!("?{}", param_values.len() + i + 1))
                .collect();
            conditions.push(format!(
                "m.code IN (SELECT code FROM movie_actors WHERE actor_id IN ({}))",
                placeholders.join(",")
            ));
            param_values.extend(actor_ids.iter().map(|v| v.to_string()));
        }
    }

    if let Some(ref genre_ids) = filter.genre_ids {
        if !genre_ids.is_empty() {
            let placeholders: Vec<String> = genre_ids.iter().enumerate()
                .map(|(i, _)| format!("?{}", param_values.len() + i + 1))
                .collect();
            conditions.push(format!(
                "m.code IN (SELECT code FROM movie_genres WHERE genre_id IN ({}))",
                placeholders.join(",")
            ));
            param_values.extend(genre_ids.iter().map(|v| v.to_string()));
        }
    }

    if let Some(ref series) = filter.series {
        conditions.push(format!("m.series = ?{}", param_values.len() + 1));
        param_values.push(series.clone());
    }

    if let Some(rating_min) = filter.rating_min {
        conditions.push(format!("m.rating >= ?{}", param_values.len() + 1));
        param_values.push(rating_min.to_string());
    }

    if let Some(rating_max) = filter.rating_max {
        conditions.push(format!("m.rating <= ?{}", param_values.len() + 1));
        param_values.push(rating_max.to_string());
    }

    if let Some(ref watch_status) = filter.watch_status {
        conditions.push(format!("m.watch_status = ?{}", param_values.len() + 1));
        param_values.push(watch_status.clone());
    }

    if let Some(has_files) = filter.has_files {
        if has_files {
            conditions.push("m.code IN (SELECT code FROM files)".into());
        } else {
            conditions.push("m.code NOT IN (SELECT code FROM files)".into());
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sort_by = filter.sort_by.as_deref().unwrap_or("created_at");
    let sort_dir = filter.sort_dir.as_deref().unwrap_or("DESC");
    let allowed_sort = match sort_by {
        "code" | "title" | "release_date" | "rating" | "created_at" | "updated_at" => sort_by,
        _ => "created_at",
    };
    let allowed_dir = if sort_dir.eq_ignore_ascii_case("ASC") { "ASC" } else { "DESC" };

    // Count total
    let count_sql = format!("SELECT COUNT(*) FROM movies m {}", where_clause);
    let total: u64 = {
        let mut stmt = conn.prepare(&count_sql).map_err(|e| e.to_string())?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values
            .iter()
            .map(|s| s as &dyn rusqlite::types::ToSql)
            .collect();
        stmt.query_row(params_refs.as_slice(), |r| r.get::<_, i64>(0)).map_err(|e| e.to_string())? as u64
    };

    let offset = ((page.max(1) - 1) * page_size) as i64;
    let limit = page_size as i64;
    let query_sql = format!(
        "SELECT code, code_norm, series, title, title_jp, runtime, release_date, \
         rating, comment, notes, watch_status, cover_path, source_url, source_site, \
         created_at, updated_at FROM movies m {} ORDER BY {} {} LIMIT ?{} OFFSET ?{}",
        where_clause, allowed_sort, allowed_dir,
        param_values.len() + 1, param_values.len() + 2
    );

    let mut stmt = conn.prepare(&query_sql).map_err(|e| e.to_string())?;
    let mut all_params: Vec<String> = param_values.clone();
    all_params.push(limit.to_string());
    all_params.push(offset.to_string());
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = all_params
        .iter()
        .map(|s| s as &dyn rusqlite::types::ToSql)
        .collect();

    let items: Vec<Movie> = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(Movie {
                code: row.get(0)?,
                code_norm: row.get(1)?,
                series: row.get(2)?,
                title: row.get(3)?,
                title_jp: row.get(4)?,
                runtime: row.get(5)?,
                release_date: row.get(6)?,
                rating: row.get(7)?,
                comment: row.get(8)?,
                notes: row.get(9)?,
                watch_status: row.get(10)?,
                cover_path: row.get(11)?,
                source_url: row.get(12)?,
                source_site: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Movie>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(PaginatedResult {
        items,
        total,
        page,
        page_size,
    })
}

#[tauri::command]
pub fn get_movie_by_code(db: State<Database>, code: String) -> Result<Movie, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let norm = normalize(&code);
    let norm_no_sep = normalize_no_sep(&code);

    conn.query_row(
        "SELECT code, code_norm, series, title, title_jp, runtime, release_date, \
         rating, comment, notes, watch_status, cover_path, source_url, source_site, \
         created_at, updated_at FROM movies \
         WHERE code_norm = ?1 OR code_norm = ?2 OR code = ?1",
        params![norm, norm_no_sep],
        |row| {
            Ok(Movie {
                code: row.get(0)?,
                code_norm: row.get(1)?,
                series: row.get(2)?,
                title: row.get(3)?,
                title_jp: row.get(4)?,
                runtime: row.get(5)?,
                release_date: row.get(6)?,
                rating: row.get(7)?,
                comment: row.get(8)?,
                notes: row.get(9)?,
                watch_status: row.get(10)?,
                cover_path: row.get(11)?,
                source_url: row.get(12)?,
                source_site: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        },
    )
    .map_err(|e| format!("Movie not found: {}", e))
}

#[tauri::command]
pub fn create_movie(
    db: State<Database>,
    code: String,
    title: Option<String>,
    title_jp: Option<String>,
    runtime: Option<i32>,
    release_date: Option<String>,
) -> Result<Movie, String> {
    let parsed = normalize_for_storage(&code);
    let series = extract_series(&parsed.canonical);

    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO movies (code, code_norm, code_kind, code_sort_key, series, title, title_jp, runtime, release_date) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                parsed.canonical,
                parsed.code_norm,
                parsed.kind.as_str(),
                parsed.sort_key,
                series,
                title,
                title_jp,
                runtime,
                release_date,
            ],
        )
        .map_err(|e| format!("Failed to create movie: {}", e))?;
    } // conn guard dropped here

    get_movie_by_code(db, parsed.canonical)
}

#[tauri::command]
pub fn suggest_movies(
    db: State<Database>,
    query: String,
    limit: u32,
) -> Result<Vec<MovieSuggestion>, String> {
    let conn = db.conn.lock().map_err(|error| error.to_string())?;
    suggest_movies_impl(&conn, &query, limit)
}

#[tauri::command]
pub fn update_movie(
    db: State<Database>,
    code: String,
    title: Option<String>,
    title_jp: Option<String>,
    runtime: Option<i32>,
    release_date: Option<String>,
    rating: Option<f64>,
    comment: Option<String>,
    notes: Option<String>,
    watch_status: Option<String>,
    series: Option<String>,
    source_url: Option<String>,
    source_site: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE movies SET title = COALESCE(?2, title), title_jp = COALESCE(?3, title_jp), \
         runtime = COALESCE(?4, runtime), release_date = COALESCE(?5, release_date), \
         rating = COALESCE(?6, rating), comment = COALESCE(?7, comment), \
         notes = COALESCE(?8, notes), watch_status = COALESCE(?9, watch_status), \
         series = COALESCE(?10, series), source_url = COALESCE(?11, source_url), \
         source_site = COALESCE(?12, source_site), updated_at = datetime('now') \
         WHERE code = ?1",
        params![normalize_for_storage(&code).canonical, title, title_jp, runtime, release_date,
                rating, comment, notes, watch_status, series, source_url, source_site],
    )
    .map_err(|e| format!("Failed to update movie: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_movie(db: State<Database>, code: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM movies WHERE code = ?1", params![normalize(&code)])
        .map_err(|e| format!("Failed to delete movie: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_movie_tags(db: State<Database>, code: String) -> Result<Vec<crate::models::Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let code = normalize(&code);
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.description, t.scope FROM tags t \
             INNER JOIN movie_tags mt ON t.id = mt.tag_id WHERE mt.code = ?1",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![code], |row| {
            Ok(crate::models::Tag {
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
pub fn add_movie_tag(db: State<Database>, code: String, tag_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let is_movie_visible: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM tags WHERE id = ?1 AND scope IN ('movie', 'both'))",
        params![tag_id],
        |row| row.get::<_, i32>(0),
    )
    .map(|value| value != 0)
    .map_err(|e| e.to_string())?;

    if !is_movie_visible {
        return Err("该标签不适用于影片".to_string());
    }

    conn.execute(
        "INSERT OR IGNORE INTO movie_tags (code, tag_id) VALUES (?1, ?2)",
        params![normalize(&code), tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_movie_tag(db: State<Database>, code: String, tag_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM movie_tags WHERE code = ?1 AND tag_id = ?2",
        params![normalize(&code), tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug)]
struct MovieCandidate {
    code: String,
    code_norm: String,
    title: Option<String>,
    release_date: Option<String>,
    code_sort_key: String,
}

fn suggest_movies_impl(
    conn: &Connection,
    query: &str,
    limit: u32,
) -> Result<Vec<MovieSuggestion>, String> {
    let forms = normalize_search_query(query);
    if forms.cleaned.is_empty() {
        return Ok(Vec::new());
    }

    let code_norm_hint = forms
        .code_norm_guess
        .clone()
        .unwrap_or_else(|| forms.cleaned.replace('-', ""));
    let mut stmt = conn
        .prepare(
            "SELECT code, code_norm, title, release_date, code_sort_key FROM movies \
             WHERE code LIKE ?1 OR code_norm LIKE ?2 OR title LIKE ?3 \
             ORDER BY updated_at DESC LIMIT 100",
        )
        .map_err(|error| error.to_string())?;

    let candidates = stmt
        .query_map(
            params![
                format!("%{}%", forms.cleaned),
                format!("%{}%", code_norm_hint),
                format!("%{}%", query.trim()),
            ],
            |row| {
                Ok(MovieCandidate {
                    code: row.get(0)?,
                    code_norm: row.get(1)?,
                    title: row.get(2)?,
                    release_date: row.get(3)?,
                    code_sort_key: row.get(4)?,
                })
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut ranked = candidates
        .into_iter()
        .filter_map(|candidate| {
            score_movie_candidate(&forms, &candidate).map(|(score, match_kind)| {
                (score, match_kind, candidate)
            })
        })
        .collect::<Vec<_>>();

    ranked.sort_by(|left, right| {
        left.0
            .cmp(&right.0)
            .then_with(|| left.2.code_sort_key.cmp(&right.2.code_sort_key))
            .then_with(|| left.2.code.cmp(&right.2.code))
    });

    Ok(ranked
        .into_iter()
        .take(limit.max(1) as usize)
        .map(|(_, match_kind, candidate)| MovieSuggestion {
            code: candidate.code,
            title: candidate.title,
            release_date: candidate.release_date,
            match_kind: match_kind.to_string(),
        })
        .collect())
}

fn score_movie_candidate<'a>(
    forms: &crate::code_parser::SearchQueryForms,
    candidate: &'a MovieCandidate,
) -> Option<(u8, &'static str)> {
    if let Some(canonical) = forms.canonical_guess.as_ref() {
        if candidate.code == *canonical {
            return Some((0, "code_exact"));
        }
    }

    if let Some(code_norm) = forms.code_norm_guess.as_ref() {
        if candidate.code_norm == *code_norm {
            return Some((1, "code_norm_exact"));
        }

        if !code_norm.is_empty() && candidate.code_norm.starts_with(code_norm) {
            return Some((2, "code_norm_prefix"));
        }
    }

    if let Some(prefix_only) = forms.prefix_only.as_ref() {
        if candidate.code.starts_with(&format!("{}-", prefix_only)) {
            return Some((3, "code_prefix"));
        }
    }

    if candidate.code.contains(&forms.cleaned) || candidate.code_norm.contains(&forms.cleaned.replace('-', "")) {
        return Some((4, "code_contains"));
    }

    if let Some(title) = candidate.title.as_ref() {
        if title.to_lowercase().contains(&forms.raw.trim().to_lowercase()) {
            return Some((5, "title_contains"));
        }
    }

    None
}

#[tauri::command]
pub fn get_movie_filter_options(
    db: State<Database>,
) -> Result<serde_json::Value, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let tags: Vec<crate::models::FilterOption> = {
        let mut stmt = conn.prepare(
            "SELECT t.name, CAST(t.id AS TEXT), COUNT(mt.code) as cnt \
             FROM tags t LEFT JOIN movie_tags mt ON t.id = mt.tag_id \
             GROUP BY t.id ORDER BY cnt DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::models::FilterOption {
                label: row.get(0)?,
                value: row.get(1)?,
                count: row.get(2)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let series: Vec<crate::models::FilterOption> = {
        let mut stmt = conn.prepare(
            "SELECT series, series, COUNT(*) as cnt FROM movies \
             WHERE series IS NOT NULL GROUP BY series ORDER BY cnt DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::models::FilterOption {
                label: row.get(0)?,
                value: row.get(1)?,
                count: row.get(2)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let actors: Vec<crate::models::FilterOption> = {
        let mut stmt = conn.prepare(
            "SELECT a.name, CAST(a.id AS TEXT), COUNT(ma.code) as cnt \
             FROM actors a LEFT JOIN movie_actors ma ON a.id = ma.actor_id \
             GROUP BY a.id ORDER BY cnt DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::models::FilterOption {
                label: row.get(0)?,
                value: row.get(1)?,
                count: row.get(2)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let genres: Vec<crate::models::FilterOption> = {
        let mut stmt = conn.prepare(
            "SELECT g.name, CAST(g.id AS TEXT), COUNT(mg.code) as cnt \
             FROM genres g LEFT JOIN movie_genres mg ON g.id = mg.genre_id \
             GROUP BY g.id ORDER BY cnt DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::models::FilterOption {
                label: row.get(0)?,
                value: row.get(1)?,
                count: row.get(2)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    Ok(serde_json::json!({
        "tags": tags,
        "series": series,
        "actors": actors,
        "genres": genres,
    }))
}

#[cfg(test)]
mod tests {
    use super::suggest_movies_impl;
    use crate::code_parser::normalize_for_storage;
    use crate::db::migrations::get_migrations;
    use rusqlite::{params, Connection};

    fn setup_connection() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        for migration in get_migrations() {
            conn.execute_batch(migration.sql).expect("apply migration");
        }
        conn
    }

    fn insert_movie(conn: &Connection, raw_code: &str, title: &str) {
        let parsed = normalize_for_storage(raw_code);
        conn.execute(
            "INSERT INTO movies (code, code_norm, code_kind, code_sort_key, series, title) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                parsed.canonical,
                parsed.code_norm,
                parsed.kind.as_str(),
                parsed.sort_key,
                parsed.prefix,
                title,
            ],
        )
        .expect("insert movie");
    }

    #[test]
    fn suggest_movies_ranks_exact_code_before_prefix_matches() {
        let conn = setup_connection();
        insert_movie(&conn, "IPX123", "Exact");
        insert_movie(&conn, "IPX1234", "Longer prefix");
        insert_movie(&conn, "IPX999", "Other");

        let results = suggest_movies_impl(&conn, "ipx123", 10).expect("suggest movies");

        assert_eq!(results[0].code, "IPX-123");
        assert_eq!(results[0].match_kind, "code_exact");
        assert_eq!(results[1].code, "IPX-1234");
    }

    #[test]
    fn suggest_movies_matches_prefix_queries_progressively() {
        let conn = setup_connection();
        insert_movie(&conn, "IPX001", "First");
        insert_movie(&conn, "IPX123", "Second");
        insert_movie(&conn, "SSIS999", "Third");

        let results = suggest_movies_impl(&conn, "ipx", 10).expect("suggest movies");

        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|item| item.code.starts_with("IPX-")));
    }
}
