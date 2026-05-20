use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const WORKSPACES_DIR: &str = "workspaces";
const ACTIVE_WORKSPACE_FILE: &str = "active-workspace.json";
const LEGACY_DB_FILE: &str = "movie-note.db";
const LEGACY_IMAGES_DIR: &str = "images";

#[derive(Debug, Serialize, Deserialize)]
struct ActiveWorkspaceFile {
    name: String,
}

pub fn normalize_workspace_name(name: &str) -> String {
    let normalized: String = name
        .trim()
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            ch if ch.is_control() => '_',
            _ => ch,
        })
        .collect();

    let trimmed = normalized.trim();
    if trimmed.is_empty() {
        "default".to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn workspace_root_dir(data_root_dir: &Path) -> PathBuf {
    data_root_dir.join(WORKSPACES_DIR)
}

pub fn workspace_dir_for_name(data_root_dir: &Path, workspace_name: &str) -> PathBuf {
    workspace_root_dir(data_root_dir).join(normalize_workspace_name(workspace_name))
}

pub fn active_workspace_file_path(data_root_dir: &Path) -> PathBuf {
    data_root_dir.join(ACTIVE_WORKSPACE_FILE)
}

pub fn read_active_workspace_name(data_root_dir: &Path) -> Result<Option<String>, String> {
    let file_path = active_workspace_file_path(data_root_dir);
    if !file_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&file_path).map_err(|error| error.to_string())?;
    let parsed: ActiveWorkspaceFile = serde_json::from_str(&content).map_err(|error| error.to_string())?;
    Ok(Some(normalize_workspace_name(&parsed.name)))
}

pub fn write_active_workspace_name(data_root_dir: &Path, workspace_name: &str) -> Result<(), String> {
    fs::create_dir_all(data_root_dir).map_err(|error| error.to_string())?;
    let file_path = active_workspace_file_path(data_root_dir);
    let record = ActiveWorkspaceFile {
        name: normalize_workspace_name(workspace_name),
    };
    let content = serde_json::to_string_pretty(&record).map_err(|error| error.to_string())?;
    fs::write(file_path, content).map_err(|error| error.to_string())
}

pub fn ensure_workspace_dir(data_root_dir: &Path, workspace_name: &str) -> Result<PathBuf, String> {
    let workspace_dir = workspace_dir_for_name(data_root_dir, workspace_name);
    fs::create_dir_all(&workspace_dir).map_err(|error| error.to_string())?;
    Ok(workspace_dir)
}

pub fn ensure_active_workspace(data_root_dir: &Path) -> Result<String, String> {
    let active_name = read_active_workspace_name(data_root_dir)?.unwrap_or_else(|| "default".to_string());
    let normalized = normalize_workspace_name(&active_name);
    write_active_workspace_name(data_root_dir, &normalized)?;
    ensure_workspace_dir(data_root_dir, &normalized)?;
    Ok(normalized)
}

pub fn list_workspace_names(data_root_dir: &Path) -> Result<Vec<String>, String> {
    let root_dir = workspace_root_dir(data_root_dir);
    fs::create_dir_all(&root_dir).map_err(|error| error.to_string())?;

    let mut names = Vec::new();
    for entry in fs::read_dir(&root_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry.file_type().map_err(|error| error.to_string())?.is_dir() {
            continue;
        }

        if let Some(name) = entry.file_name().to_str() {
            names.push(normalize_workspace_name(name));
        }
    }

    if names.is_empty() {
        names.push("default".to_string());
        ensure_workspace_dir(data_root_dir, "default")?;
    }

    names.sort_by(|left, right| left.to_lowercase().cmp(&right.to_lowercase()));
    names.dedup();
    Ok(names)
}

pub fn migrate_legacy_workspace_files(data_root_dir: &Path, workspace_name: &str) -> Result<(Option<PathBuf>, Option<PathBuf>), String> {
    let normalized_name = normalize_workspace_name(workspace_name);
    let workspace_dir = ensure_workspace_dir(data_root_dir, &normalized_name)?;

    let legacy_db_path = data_root_dir.join(LEGACY_DB_FILE);
    let workspace_db_path = workspace_dir.join(LEGACY_DB_FILE);
    if legacy_db_path.exists() && !workspace_db_path.exists() {
        move_path(&legacy_db_path, &workspace_db_path)?;
    }

    let legacy_images_dir = data_root_dir.join(LEGACY_IMAGES_DIR);
    let workspace_images_dir = workspace_dir.join(LEGACY_IMAGES_DIR);
    let legacy_images_existed = legacy_images_dir.exists();
    if legacy_images_existed && !workspace_images_dir.exists() {
        move_path(&legacy_images_dir, &workspace_images_dir)?;
    }

    Ok((
        if legacy_images_existed { Some(legacy_images_dir) } else { None },
        if workspace_images_dir.exists() { Some(workspace_images_dir) } else { None },
    ))
}

pub fn rewrite_image_paths(conn: &Connection, old_prefix: &Path, new_prefix: &Path) -> Result<(), String> {
    let old_prefix = old_prefix.to_string_lossy().replace('\\', "/");
    let new_prefix = new_prefix.to_string_lossy().replace('\\', "/");

    if old_prefix == new_prefix {
        return Ok(());
    }

    let updates = [
        ("movies", "cover_path"),
        ("movie_covers", "image_path"),
        ("movie_screenshots", "image_path"),
        ("actors", "avatar_path"),
        ("actor_images", "image_path"),
    ];

    for (table, column) in updates {
        let sql = format!(
            "UPDATE {table} SET {column} = REPLACE(REPLACE({column}, ?1, ?2), ?3, ?4) WHERE {column} LIKE ?5 OR {column} LIKE ?6",
        );
        let old_prefix_backslash = old_prefix.replace('/', "\\");
        let new_prefix_backslash = new_prefix.replace('/', "\\");
        let like_forward = format!("{}%", old_prefix);
        let like_backward = format!("{}%", old_prefix_backslash);
        conn.execute(
            &sql,
            params![
                old_prefix,
                new_prefix,
                old_prefix_backslash,
                new_prefix_backslash,
                like_forward,
                like_backward,
            ],
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn move_path(source: &Path, destination: &Path) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    match fs::rename(source, destination) {
        Ok(()) => Ok(()),
        Err(_) => {
            if source.is_dir() {
                copy_dir_all(source, destination).map_err(|error| error.to_string())?;
                fs::remove_dir_all(source).map_err(|error| error.to_string())?;
            } else {
                fs::copy(source, destination).map_err(|error| error.to_string())?;
                fs::remove_file(source).map_err(|error| error.to_string())?;
            }
            Ok(())
        }
    }
}

fn copy_dir_all(source: &Path, destination: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let target = destination.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_all(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_workspace_root(prefix: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("movie-note-{prefix}-{unique}"))
    }

    #[test]
    fn normalize_workspace_name_sanitizes_invalid_chars() {
        assert_eq!(normalize_workspace_name("  Alice/Dev:01  "), "Alice_Dev_01");
        assert_eq!(normalize_workspace_name(""), "default");
        assert_eq!(normalize_workspace_name("   \t\n"), "default");
    }

    #[test]
    fn active_workspace_roundtrip_uses_json_file() {
        let root = temp_workspace_root("active-roundtrip");
        fs::create_dir_all(&root).unwrap();

        write_active_workspace_name(&root, "Alice").unwrap();
        let active = read_active_workspace_name(&root).unwrap();

        assert_eq!(active.as_deref(), Some("Alice"));
    }

    #[test]
    fn list_workspace_names_creates_default_when_empty() {
        let root = temp_workspace_root("list-empty");
        fs::create_dir_all(&root).unwrap();

        let names = list_workspace_names(&root).unwrap();

        assert_eq!(names, vec!["default".to_string()]);
        assert!(workspace_dir_for_name(&root, "default").exists());
    }

    #[test]
    fn migrate_legacy_workspace_files_moves_database_and_images() {
        let root = temp_workspace_root("migrate-legacy");
        fs::create_dir_all(&root).unwrap();

        let legacy_db = root.join(LEGACY_DB_FILE);
        fs::write(&legacy_db, b"sqlite-placeholder").unwrap();

        let legacy_images = root.join(LEGACY_IMAGES_DIR);
        fs::create_dir_all(&legacy_images).unwrap();
        let mut image_file = fs::File::create(legacy_images.join("cover.jpg")).unwrap();
        image_file.write_all(b"image-bytes").unwrap();

        migrate_legacy_workspace_files(&root, "default").unwrap();

        let workspace_dir = workspace_dir_for_name(&root, "default");
        assert!(workspace_dir.join(LEGACY_DB_FILE).exists());
        assert!(workspace_dir.join(LEGACY_IMAGES_DIR).join("cover.jpg").exists());
        assert!(!legacy_db.exists());
        assert!(!legacy_images.exists());
    }

    #[test]
    fn rewrite_image_paths_updates_workspace_prefixes() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE movies (code TEXT PRIMARY KEY, cover_path TEXT);
             CREATE TABLE movie_covers (id INTEGER PRIMARY KEY, code TEXT, image_path TEXT, is_primary INTEGER, source TEXT);
             CREATE TABLE movie_screenshots (id INTEGER PRIMARY KEY, code TEXT, image_path TEXT, sort_order INTEGER);
             CREATE TABLE actors (id INTEGER PRIMARY KEY, name TEXT, avatar_path TEXT);
             CREATE TABLE actor_images (id INTEGER PRIMARY KEY, actor_id INTEGER, image_path TEXT, sort_order INTEGER);",
        )
        .unwrap();

        let old_prefix = PathBuf::from(r"D:\self\movie-note\AppData\workspaces\legacy\images");
        let new_prefix = PathBuf::from(r"D:\self\movie-note\AppData\workspaces\default\images");
        let movie_cover = old_prefix.join("movie.jpg").to_string_lossy().replace('/', "\\");
        let actor_avatar = old_prefix.join("actor.jpg").to_string_lossy().replace('/', "\\");

        conn.execute(
            "INSERT INTO movies (code, cover_path) VALUES ('IPX-123', ?1)",
            [&movie_cover],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO actors (id, name, avatar_path) VALUES (1, 'Alice', ?1)",
            [&actor_avatar],
        )
        .unwrap();

        rewrite_image_paths(&conn, &old_prefix, &new_prefix).unwrap();

        let cover_path: String = conn
            .query_row("SELECT cover_path FROM movies WHERE code='IPX-123'", [], |row| row.get(0))
            .unwrap();
        let avatar_path: String = conn
            .query_row("SELECT avatar_path FROM actors WHERE id=1", [], |row| row.get(0))
            .unwrap();

        assert!(cover_path.contains("workspaces\\default\\images"));
        assert!(avatar_path.contains("workspaces\\default\\images"));
    }
}