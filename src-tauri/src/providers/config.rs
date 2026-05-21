use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub provider_type: String, // "local" | "webdav"
    pub endpoint: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub root: Option<String>, // local root directory
}

fn config_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("providers.json")
}

pub fn load_configs(app_data_dir: &PathBuf) -> Result<Vec<ProviderConfig>, String> {
    let path = config_path(app_data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = fs::read_to_string(&path).map_err(|e| format!("Failed to read providers.json: {}", e))?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse providers.json: {}", e))
}

pub fn save_configs(app_data_dir: &PathBuf, configs: &[ProviderConfig]) -> Result<(), String> {
    let path = config_path(app_data_dir);
    let data = serde_json::to_string_pretty(configs).map_err(|e| format!("Failed to serialize: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("Failed to write providers.json: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_dir() -> PathBuf {
        env::temp_dir().join("movie-note-test-config")
    }

    fn cleanup(dir: &PathBuf) {
        let _ = fs::remove_file(config_path(dir));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn load_returns_empty_when_no_file() {
        let dir = temp_dir().join("empty-test");
        let _ = fs::create_dir_all(&dir);
        let result = load_configs(&dir).unwrap();
        assert!(result.is_empty());
        cleanup(&dir);
    }

    #[test]
    fn save_and_load_roundtrip() {
        let dir = temp_dir().join("roundtrip-test");
        let _ = fs::create_dir_all(&dir);

        let configs = vec![
            ProviderConfig {
                id: "c1".into(),
                name: "My WebDAV".into(),
                provider_type: "webdav".into(),
                endpoint: Some("https://dav.example.com".into()),
                username: Some("user".into()),
                password: Some("pass".into()),
                root: None,
            },
            ProviderConfig {
                id: "c2".into(),
                name: "Local Drive".into(),
                provider_type: "local".into(),
                endpoint: None,
                username: None,
                password: None,
                root: Some("D:\\movies".into()),
            },
        ];

        save_configs(&dir, &configs).unwrap();
        let loaded = load_configs(&dir).unwrap();
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].id, "c1");
        assert_eq!(loaded[0].name, "My WebDAV");
        assert_eq!(loaded[0].endpoint.as_deref(), Some("https://dav.example.com"));
        assert_eq!(loaded[1].id, "c2");
        assert_eq!(loaded[1].provider_type, "local");
        assert_eq!(loaded[1].root.as_deref(), Some("D:\\movies"));

        cleanup(&dir);
    }

    #[test]
    fn save_overwrites_existing_file() {
        let dir = temp_dir().join("overwrite-test");
        let _ = fs::create_dir_all(&dir);

        let configs = vec![ProviderConfig {
            id: "only".into(),
            name: "First".into(),
            provider_type: "webdav".into(),
            endpoint: Some("https://a.example.com".into()),
            username: None,
            password: None,
            root: None,
        }];
        save_configs(&dir, &configs).unwrap();

        let configs2 = vec![ProviderConfig {
            id: "only".into(),
            name: "Updated".into(),
            provider_type: "webdav".into(),
            endpoint: Some("https://b.example.com".into()),
            username: None,
            password: None,
            root: None,
        }];
        save_configs(&dir, &configs2).unwrap();

        let loaded = load_configs(&dir).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].name, "Updated");
        assert_eq!(loaded[0].endpoint.as_deref(), Some("https://b.example.com"));

        cleanup(&dir);
    }
}
