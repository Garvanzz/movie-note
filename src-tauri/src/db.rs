use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_data_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&app_data_dir).ok();
        let db_path = app_data_dir.join("movie-note.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS movies (
                code TEXT PRIMARY KEY,
                code_norm TEXT NOT NULL,
                series TEXT,
                title TEXT,
                title_jp TEXT,
                runtime INTEGER,
                release_date TEXT,
                rating REAL,
                comment TEXT,
                notes TEXT,
                watch_status TEXT NOT NULL DEFAULT 'pending',
                cover_path TEXT,
                source_url TEXT,
                source_site TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );

            CREATE TABLE IF NOT EXISTS actors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                name_jp TEXT,
                measurements TEXT,
                birth_date TEXT,
                debut_year INTEGER,
                rating REAL,
                comment TEXT,
                avatar_path TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );

            CREATE TABLE IF NOT EXISTS movie_actors (
                movie_code TEXT NOT NULL REFERENCES movies(code) ON DELETE CASCADE,
                actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
                PRIMARY KEY (movie_code, actor_id)
            );

            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS tag_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS movie_tags (
                movie_code TEXT NOT NULL REFERENCES movies(code) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (movie_code, tag_id)
            );

            CREATE TABLE IF NOT EXISTS genres (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS movie_genres (
                movie_code TEXT NOT NULL REFERENCES movies(code) ON DELETE CASCADE,
                genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
                PRIMARY KEY (movie_code, genre_id)
            );

            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                movie_code TEXT NOT NULL REFERENCES movies(code) ON DELETE CASCADE,
                file_path TEXT NOT NULL,
                file_name TEXT,
                file_size INTEGER
            );
            ",
        )?;
        Ok(())
    }
}
