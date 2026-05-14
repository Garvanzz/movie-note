use crate::db::Database;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::{FilterOption, PaginatedResult};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Movie {
    pub code: String,
    pub code_norm: String,
    pub series: Option<String>,
    pub title: Option<String>,
    pub title_jp: Option<String>,
    pub runtime: Option<i32>,
    pub release_date: Option<String>,
    pub rating: Option<f64>,
    pub comment: Option<String>,
    pub notes: Option<String>,
    pub watch_status: String,
    pub cover_path: Option<String>,
    pub source_url: Option<String>,
    pub source_site: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct MovieFilter {
    pub search: Option<String>,
    pub tag_ids: Option<Vec<i64>>,
    pub actor_ids: Option<Vec<i64>>,
    pub genre_ids: Option<Vec<i64>>,
    pub series: Option<String>,
    pub rating_min: Option<f64>,
    pub rating_max: Option<f64>,
    pub watch_status: Option<String>,
    pub has_files: Option<bool>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MovieFilterOptions {
    pub tags: Vec<FilterOption>,
    pub series: Vec<FilterOption>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tag {
    pub id: i64,
    pub name: String,
}

#[tauri::command]
pub fn get_movies(
    db: State<Database>,
    filter: MovieFilter,
    page: i64,
    page_size: i64,
) -> Result<PaginatedResult<Movie>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut where_clauses = vec!["1=1".to_string()];
    let mut bind_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(ref search) = filter.search {
        let s = format!("%{}%", search);
        where_clauses.push(
            "(m.code LIKE ? OR m.title LIKE ? OR m.title_jp LIKE ? OR m.series LIKE ?)".to_string(),
        );
        bind_params.push(Box::new(s.clone()));
        bind_params.push(Box::new(s.clone()));
        bind_params.push(Box::new(s.clone()));
        bind_params.push(Box::new(s));
    }

    if let Some(ref tag_ids) = filter.tag_ids {
        if !tag_ids.is_empty() {
            let placeholders = tag_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            where_clauses.push(format!(
                "m.code IN (SELECT movie_code FROM movie_tags WHERE tag_id IN ({}))",
                placeholders
            ));
            for id in tag_ids {
                bind_params.push(Box::new(*id));
            }
        }
    }

    if let Some(ref actor_ids) = filter.actor_ids {
        if !actor_ids.is_empty() {
            let placeholders = actor_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            where_clauses.push(format!(
                "m.code IN (SELECT movie_code FROM movie_actors WHERE actor_id IN ({}))",
                placeholders
            ));
            for id in actor_ids {
                bind_params.push(Box::new(*id));
            }
        }
    }

    if let Some(ref genre_ids) = filter.genre_ids {
        if !genre_ids.is_empty() {
            let placeholders = genre_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            where_clauses.push(format!(
                "m.code IN (SELECT movie_code FROM movie_genres WHERE genre_id IN ({}))",
                placeholders
            ));
            for id in genre_ids {
                bind_params.push(Box::new(*id));
            }
        }
    }

    if let Some(ref series) = filter.series {
        where_clauses.push("m.series = ?".to_string());
        bind_params.push(Box::new(series.clone()));
    }

    if let Some(min) = filter.rating_min {
        where_clauses.push("m.rating >= ?".to_string());
        bind_params.push(Box::new(min));
    }

    if let Some(max) = filter.rating_max {
        where_clauses.push("m.rating <= ?".to_string());
        bind_params.push(Box::new(max));
    }

    if let Some(ref status) = filter.watch_status {
        where_clauses.push("m.watch_status = ?".to_string());
        bind_params.push(Box::new(status.clone()));
    }

    if filter.has_files == Some(true) {
        where_clauses.push(
            "m.code IN (SELECT movie_code FROM files)".to_string(),
        );
    } else if filter.has_files == Some(false) {
        where_clauses.push(
            "m.code NOT IN (SELECT movie_code FROM files)".to_string(),
        );
    }

    let where_sql = where_clauses.join(" AND ");

    let sort_by = match filter.sort_by.as_deref() {
        Some("release_date") => "m.release_date",
        Some("rating") => "m.rating",
        Some("created_at") => "m.created_at",
        _ => "m.created_at",
    };
    let sort_dir = match filter.sort_dir.as_deref() {
        Some("asc") => "ASC",
        _ => "DESC",
    };

    let count_sql = format!("SELECT COUNT(*) FROM movies m WHERE {}", where_sql);
    let total: i64 = {
        let mut stmt = conn.prepare(&count_sql).map_err(|e| e.to_string())?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> = bind_params.iter().map(|p| p.as_ref()).collect();
        stmt.query_row(params_refs.as_slice(), |row| row.get(0))
            .map_err(|e| e.to_string())?
    };

    let offset = (page - 1) * page_size;
    let query_sql = format!(
        "SELECT m.* FROM movies m WHERE {} ORDER BY {} {} LIMIT ? OFFSET ?",
        where_sql, sort_by, sort_dir
    );
    bind_params.push(Box::new(page_size));
    bind_params.push(Box::new(offset));

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = bind_params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&query_sql).map_err(|e| e.to_string())?;
    let items = stmt
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
pub fn get_movie_by_code(db: State<Database>, code: String) -> Result<Movie, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT * FROM movies WHERE code = ?",
        params![code],
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
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let code_norm = code.to_uppercase().replace('-', "").replace('_', "");
    conn.execute(
        "INSERT INTO movies (code, code_norm, title, title_jp, runtime, release_date) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![code, code_norm, title, title_jp, runtime, release_date],
    )
    .map_err(|e| format!("Failed to create movie: {}", e))?;
    drop(conn);
    get_movie_by_code(db, code)
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
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE movies SET
            title = COALESCE(?2, title),
            title_jp = COALESCE(?3, title_jp),
            runtime = COALESCE(?4, runtime),
            release_date = COALESCE(?5, release_date),
            rating = COALESCE(?6, rating),
            comment = COALESCE(?7, comment),
            notes = COALESCE(?8, notes),
            watch_status = COALESCE(?9, watch_status),
            series = COALESCE(?10, series),
            updated_at = datetime('now', 'localtime')
        WHERE code = ?1",
        params![code, title, title_jp, runtime, release_date, rating, comment, notes, watch_status, series],
    )
    .map_err(|e| format!("Failed to update movie: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn delete_movie(db: State<Database>, code: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM movies WHERE code = ?", params![code])
        .map_err(|e| format!("Failed to delete movie: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_movie_tags(db: State<Database>, code: String) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT t.id, t.name FROM tags t INNER JOIN movie_tags mt ON t.id = mt.tag_id WHERE mt.movie_code = ?")
        .map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map(params![code], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(tags)
}

#[tauri::command]
pub fn add_movie_tag(db: State<Database>, code: String, tag_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO movie_tags (movie_code, tag_id) VALUES (?1, ?2)",
        params![code, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_movie_tag(db: State<Database>, code: String, tag_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM movie_tags WHERE movie_code = ?1 AND tag_id = ?2",
        params![code, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_movie_filter_options(db: State<Database>) -> Result<MovieFilterOptions, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT t.name, CAST(t.id AS TEXT), COUNT(mt.movie_code) FROM tags t LEFT JOIN movie_tags mt ON t.id = mt.tag_id GROUP BY t.id ORDER BY t.name")
        .map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map([], |row| {
            Ok(FilterOption {
                label: row.get(0)?,
                value: row.get(1)?,
                count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut stmt = conn
        .prepare("SELECT DISTINCT series, COUNT(*) FROM movies WHERE series IS NOT NULL AND series != '' GROUP BY series ORDER BY series")
        .map_err(|e| e.to_string())?;
    let series = stmt
        .query_map([], |row| {
            Ok(FilterOption {
                label: row.get(0)?,
                value: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(MovieFilterOptions { tags, series })
}
