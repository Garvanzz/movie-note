CREATE TABLE IF NOT EXISTS _schema_version (
    version INTEGER NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE movies (
    code TEXT PRIMARY KEY,
    code_norm TEXT NOT NULL,
    series TEXT,
    title TEXT,
    title_jp TEXT,
    runtime INTEGER,
    release_date TEXT,
    rating REAL CHECK(rating >= 0 AND rating <= 10),
    comment TEXT,
    notes TEXT,
    watch_status TEXT NOT NULL DEFAULT 'unwatched'
        CHECK(watch_status IN ('unwatched','watched','watching','paused')),
    cover_path TEXT,
    source_url TEXT,
    source_site TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_movies_code_norm ON movies(code_norm);
CREATE INDEX idx_movies_series ON movies(series);
CREATE INDEX idx_movies_watch_status ON movies(watch_status);

CREATE TABLE code_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL REFERENCES movies(code) ON DELETE CASCADE,
    alias TEXT NOT NULL UNIQUE,
    alias_type TEXT NOT NULL DEFAULT 'variant'
        CHECK(alias_type IN ('variant','alt-format','search'))
);

CREATE INDEX idx_code_aliases_code ON code_aliases(code);
CREATE INDEX idx_code_aliases_alias ON code_aliases(alias);

CREATE TABLE actors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_jp TEXT,
    measurements TEXT,
    birth_date TEXT,
    debut_year INTEGER,
    rating REAL CHECK(rating >= 0 AND rating <= 10),
    comment TEXT,
    avatar_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_actors_name ON actors(name);

CREATE TABLE actor_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    UNIQUE(actor_id, alias)
);

CREATE TABLE actor_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(actor_id, tag_id)
);

CREATE TABLE actor_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE actor_category_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES actor_categories(id) ON DELETE CASCADE,
    UNIQUE(actor_id, category_id)
);

CREATE TABLE actor_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE tag_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tag_group_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES tag_groups(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(group_id, tag_id)
);

CREATE TABLE genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE movie_actors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL REFERENCES movies(code) ON DELETE CASCADE,
    actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    UNIQUE(code, actor_id)
);

CREATE INDEX idx_movie_actors_code ON movie_actors(code);
CREATE INDEX idx_movie_actors_actor ON movie_actors(actor_id);

CREATE TABLE movie_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL REFERENCES movies(code) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(code, tag_id)
);

CREATE INDEX idx_movie_tags_code ON movie_tags(code);
CREATE INDEX idx_movie_tags_tag ON movie_tags(tag_id);

CREATE TABLE movie_genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL REFERENCES movies(code) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    UNIQUE(code, genre_id)
);

CREATE TABLE movie_covers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL REFERENCES movies(code) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    source TEXT DEFAULT 'local'
);

CREATE INDEX idx_movie_covers_code ON movie_covers(code);

CREATE TABLE movie_screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL REFERENCES movies(code) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_movie_screenshots_code ON movie_screenshots(code);

CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL REFERENCES movies(code) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    UNIQUE(code, file_path)
);

CREATE INDEX idx_files_code ON files(code);
