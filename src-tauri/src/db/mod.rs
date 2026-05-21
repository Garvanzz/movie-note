pub mod migrations;
pub mod workspace;

use crate::code_parser::{extract_series, normalize_for_storage};
use rusqlite::{params, Connection};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
    pub data_root_dir: PathBuf,
    pub app_data_dir: PathBuf,
    pub workspace_name: String,
}

impl Database {
    pub fn new(data_root_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&data_root_dir).map_err(|error| error.to_string())?;

        let workspace_name = workspace::ensure_active_workspace(&data_root_dir)?;
        let (legacy_images_dir, workspace_images_dir) = workspace::migrate_legacy_workspace_files(&data_root_dir, &workspace_name)?;

        let workspace_dir = workspace::ensure_workspace_dir(&data_root_dir, &workspace_name)?;
        let db_path = workspace_dir.join("movie-note.db");
        let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|error| error.to_string())?;
        let db = Self {
            conn: Mutex::new(conn),
            data_root_dir,
            app_data_dir: workspace_dir,
            workspace_name,
        };
        db.run_migrations()?;

        if let (Some(old_prefix), Some(new_prefix)) = (legacy_images_dir, workspace_images_dir) {
            let conn = db.conn.lock().map_err(|error| error.to_string())?;
            workspace::rewrite_image_paths(&conn, &old_prefix, &new_prefix)?;
        }

        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), String> {
        let mut conn = self.conn.lock().map_err(|error| error.to_string())?;
        let current: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version),0) FROM _schema_version",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let migrations = migrations::get_migrations();
        for m in migrations.iter().filter(|m| m.version > current) {
            conn.execute_batch(m.sql).map_err(|error| error.to_string())?;
            conn.execute(
                "INSERT INTO _schema_version (version) VALUES (?1)",
                [m.version],
            )
            .map_err(|error| error.to_string())?;
        }
        backfill_movie_codes(&mut conn)?;
        Ok(())
    }
}

pub fn backfill_movie_codes(conn: &mut Connection) -> Result<(), String> {
    let movie_codes: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT code FROM movies ORDER BY created_at, code")
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        rows
    };

    if movie_codes.is_empty() {
        return Ok(());
    }

    struct MovieUpdate {
        old_code: String,
        new_code: String,
        code_norm: String,
        code_kind: String,
        code_sort_key: String,
        series: Option<String>,
    }

    let mut seen_codes = HashMap::<String, String>::new();
    let mut updates = Vec::with_capacity(movie_codes.len());

    for old_code in movie_codes {
        let parsed = normalize_for_storage(&old_code);
        if let Some(existing) = seen_codes.insert(parsed.canonical.clone(), old_code.clone()) {
            if existing != old_code {
                return Err(format!(
                    "Code normalization collision: '{}' and '{}' both normalize to '{}'",
                    existing, old_code, parsed.canonical
                ));
            }
        }

        updates.push(MovieUpdate {
            old_code,
            new_code: parsed.canonical.clone(),
            code_norm: parsed.code_norm,
            code_kind: parsed.kind.as_str().to_string(),
            code_sort_key: parsed.sort_key,
            series: extract_series(&parsed.canonical),
        });
    }

    conn.execute_batch("PRAGMA foreign_keys=OFF;")
        .map_err(|error| error.to_string())?;

    let result = (|| {
        let tx = conn.transaction().map_err(|error| error.to_string())?;

        for update in updates {
            if update.old_code != update.new_code {
                for table in [
                    "code_aliases",
                    "movie_actors",
                    "movie_tags",
                    "movie_genres",
                    "movie_covers",
                    "movie_screenshots",
                    "files",
                ] {
                    tx.execute(
                        &format!("UPDATE {table} SET code = ?1 WHERE code = ?2"),
                        params![update.new_code, update.old_code],
                    )
                    .map_err(|error| error.to_string())?;
                }
            }

            tx.execute(
                "UPDATE movies SET code = ?1, code_norm = ?2, code_kind = ?3, code_sort_key = ?4, \
                 series = CASE WHEN series IS NULL OR TRIM(series) = '' THEN ?5 ELSE series END \
                 WHERE code = ?6",
                params![
                    update.new_code,
                    update.code_norm,
                    update.code_kind,
                    update.code_sort_key,
                    update.series,
                    update.old_code,
                ],
            )
            .map_err(|error| error.to_string())?;
        }

        tx.commit().map_err(|error| error.to_string())
    })();

    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|error| error.to_string())?;

    result?;

    let fk_violations: i64 = conn
        .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if fk_violations > 0 {
        return Err(format!("Foreign key violations detected after code backfill: {fk_violations}"));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    fn test_db() -> Database {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        Database {
            conn: Mutex::new(conn),
            data_root_dir: std::env::temp_dir(),
            app_data_dir: std::env::temp_dir(),
            workspace_name: "default".into(),
        }
    }

    #[test]
    fn test_migrations_create_all_tables() {
        let db = test_db();
        db.run_migrations().unwrap();

        let conn = db.conn.lock().unwrap();
        let table_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table'",
                [],
                |r| r.get(0),
            )
            .unwrap();

        // 19 user tables + _schema_version + sqlite_sequence
        assert!(table_count >= 19, "Expected at least 19 tables");

        // Verify key tables exist
        let tables = ["movies", "actors", "tags", "genres", "tag_groups",
            "movie_actors", "movie_tags", "movie_genres", "movie_covers",
            "movie_screenshots", "files", "code_aliases", "actor_aliases",
            "actor_tags", "actor_categories", "actor_category_relations",
            "actor_images", "actor_names", "tag_group_items"];
        for table in &tables {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name=?1",
                    [table],
                    |r| r.get(0),
                )
                .unwrap();
            assert!(exists, "Table {} should exist", table);
        }
    }

    #[test]
    fn test_migration_version_tracking() {
        let db = test_db();
        db.run_migrations().unwrap();

        let conn = db.conn.lock().unwrap();
        let version: i32 = conn
            .query_row(
                "SELECT MAX(version) FROM _schema_version",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(version >= 1, "Migration version should be >= 1");
    }

    #[test]
    fn test_migration_adds_code_search_columns() {
        let db = test_db();
        db.run_migrations().unwrap();

        let conn = db.conn.lock().unwrap();
        let mut stmt = conn.prepare("PRAGMA table_info(movies)").unwrap();
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(columns.contains(&"code_kind".to_string()));
        assert!(columns.contains(&"code_sort_key".to_string()));

        let mut stmt = conn.prepare("PRAGMA index_list(movies)").unwrap();
        let indexes = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(indexes.contains(&"idx_movies_code_kind".to_string()));
        assert!(indexes.contains(&"idx_movies_code_sort_key".to_string()));

        let alias_index_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_index_list('actor_aliases') WHERE name = ?1",
                params!["idx_actor_aliases_alias"],
                |row| row.get(0),
            )
            .unwrap();
        assert!(alias_index_exists, "actor alias index should exist");
    }

    #[test]
    fn test_backfill_movie_codes_rewrites_existing_codes_and_children() {
        let db = test_db();
        db.run_migrations().unwrap();

        let mut conn = db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO movies (code, code_norm, code_kind, code_sort_key, title) VALUES (?1, ?2, ?3, ?4, ?5)",
            params!["ipx123", "ipx123", "unknown", "", "Test Movie"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (code, file_path) VALUES (?1, ?2)",
            params!["ipx123", "D:/movies/ipx123.mp4"],
        )
        .unwrap();

        backfill_movie_codes(&mut conn).unwrap();

        let (code, code_norm, code_kind): (String, String, String) = conn
            .query_row(
                "SELECT code, code_norm, code_kind FROM movies LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(code, "IPX-123");
        assert_eq!(code_norm, "IPX123");
        assert_eq!(code_kind, "standard");

        let file_code: String = conn
            .query_row("SELECT code FROM files LIMIT 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(file_code, "IPX-123");
    }
}
