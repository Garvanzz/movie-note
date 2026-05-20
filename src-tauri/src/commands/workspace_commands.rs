use tauri::{AppHandle, State};

use crate::db::{workspace, Database};
use crate::models::WorkspaceInfo;

#[tauri::command]
pub fn list_workspaces(db: State<Database>) -> Result<Vec<WorkspaceInfo>, String> {
    build_workspace_infos(&db.data_root_dir, Some(&db.workspace_name))
}

#[tauri::command]
pub fn switch_workspace(app: AppHandle, db: State<Database>, name: String) -> Result<(), String> {
    let normalized = workspace::normalize_workspace_name(&name);
    if normalized.is_empty() {
        return Err("工作区名称不能为空".into());
    }

    workspace::ensure_workspace_dir(&db.data_root_dir, &normalized)?;
    workspace::write_active_workspace_name(&db.data_root_dir, &normalized)?;
    app.restart();
}

fn build_workspace_infos(data_root_dir: &std::path::Path, fallback_active: Option<&str>) -> Result<Vec<WorkspaceInfo>, String> {
    let active_name = workspace::read_active_workspace_name(data_root_dir)?
        .or_else(|| fallback_active.map(|value| value.to_string()))
        .unwrap_or_else(|| "default".to_string());
    let names = workspace::list_workspace_names(data_root_dir)?;

    Ok(names
        .into_iter()
        .map(|name| WorkspaceInfo {
            is_active: name == active_name,
            name,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use rusqlite::Connection;
    use std::path::PathBuf;
    use std::sync::Mutex;

    fn test_db(root: PathBuf, active: &str) -> Database {
        let conn = Connection::open_in_memory().unwrap();
        Database {
            conn: Mutex::new(conn),
            data_root_dir: root.clone(),
            app_data_dir: root.join(active),
            workspace_name: active.to_string(),
        }
    }

    #[test]
    fn build_workspace_infos_marks_active_workspace() {
        let root = std::env::temp_dir().join("movie-note-workspace-list-test");
        std::fs::create_dir_all(root.join("workspaces/default")).unwrap();
        std::fs::create_dir_all(root.join("workspaces/alice")).unwrap();
        workspace::write_active_workspace_name(&root, "alice").unwrap();

        let db = test_db(root.clone(), "alice");
        let items = build_workspace_infos(&db.data_root_dir, Some(&db.workspace_name)).unwrap();

        assert!(items.iter().any(|item| item.name == "alice" && item.is_active));
        assert!(items.iter().any(|item| item.name == "default"));
    }
}