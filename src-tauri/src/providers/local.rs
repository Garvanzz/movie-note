use std::fs;
use std::path::Path;

use crate::models::ProviderFileEntry;
use crate::providers::FileProvider;

pub struct LocalProvider {
    /// Optional root directory to scope file access.
    /// When None, the full filesystem is accessible.
    root: Option<String>,
}

impl LocalProvider {
    pub fn new(root: Option<String>) -> Self {
        Self { root }
    }

    fn resolve(&self, relative: &str) -> String {
        match &self.root {
            Some(root) => {
                let base = Path::new(root);
                // If relative is already absolute and starts with root, use as-is.
                if Path::new(relative).is_absolute() && relative.starts_with(root) {
                    relative.to_string()
                } else {
                    base.join(relative.trim_start_matches(&['/', '\\']))
                        .to_string_lossy()
                        .to_string()
                }
            }
            None => relative.to_string(),
        }
    }
}

impl FileProvider for LocalProvider {
    fn name(&self) -> &str {
        "local"
    }

    fn search(&self, code: &str) -> Result<Vec<ProviderFileEntry>, String> {
        // For local provider, "search" walks a directory if one is configured.
        // When root is set, look for files whose name contains the code.
        let root = match &self.root {
            Some(r) => r.clone(),
            None => return Ok(vec![]),
        };

        let entries = walk_dir(&root, code)?;
        Ok(entries)
    }

    fn list(&self, path: &str) -> Result<Vec<ProviderFileEntry>, String> {
        let resolved = self.resolve(path);
        let dir = Path::new(&resolved);
        if !dir.is_dir() {
            return Err(format!("Not a directory: {}", resolved));
        }

        let mut entries = Vec::new();
        let read_dir = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

        for entry in read_dir {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let file_type = entry.file_type().map_err(|e| format!("Failed to read file type: {}", e))?;
            let file_name = entry.file_name().to_string_lossy().to_string();
            let file_path = entry.path().to_string_lossy().to_string();

            let file_size = if file_type.is_file() {
                entry.metadata().ok().map(|m| m.len() as i64)
            } else {
                None
            };

            entries.push(ProviderFileEntry {
                file_id: file_path.clone(),
                file_name,
                file_size,
                file_url: Some(format!("file:///{}", file_path.replace('\\', "/"))),
                is_directory: file_type.is_dir(),
            });
        }

        // Sort: directories first, then alphabetical
        entries.sort_by(|a, b| {
            b.is_directory
                .cmp(&a.is_directory)
                .then_with(|| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()))
        });

        Ok(entries)
    }

    fn open(&self, file_id: &str) -> Result<(), String> {
        let path = self.resolve(file_id);
        opener::open(&path).map_err(|e| format!("Failed to open file: {}", e))
    }

    fn resolve_playback_url(&self, file_id: &str) -> Result<String, String> {
        let path = self.resolve(file_id);
        let abs = if Path::new(&path).is_absolute() {
            path
        } else {
            std::env::current_dir()
                .map_err(|e| format!("Failed to get current dir: {}", e))?
                .join(&path)
                .to_string_lossy()
                .to_string()
        };
        Ok(format!("file:///{}", abs.replace('\\', "/")))
    }
}

/// Walk a directory tree looking for files whose name matches `code`.
fn walk_dir(root: &str, code: &str) -> Result<Vec<ProviderFileEntry>, String> {
    let mut results = Vec::new();
    let code_lower = code.to_lowercase();

    fn recurse(dir: &Path, code_lower: &str, results: &mut Vec<ProviderFileEntry>) -> Result<(), String> {
        let read_dir = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

        for entry in read_dir {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let file_type = entry.file_type().map_err(|e| format!("Failed to read file type: {}", e))?;
            let file_name = entry.file_name().to_string_lossy().to_string();
            let file_path = entry.path().to_string_lossy().to_string();

            if file_type.is_dir() {
                // Only recurse one level for performance
                recurse(entry.path().as_path(), code_lower, results)?;
            } else if file_name.to_lowercase().contains(code_lower) {
                let file_size = entry.metadata().ok().map(|m| m.len() as i64);
                results.push(ProviderFileEntry {
                    file_id: file_path.clone(),
                    file_name,
                    file_size,
                    file_url: Some(format!("file:///{}", file_path.replace('\\', "/"))),
                    is_directory: false,
                });
            }
        }
        Ok(())
    }

    recurse(Path::new(root), &code_lower, &mut results)?;
    results.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    Ok(results)
}
