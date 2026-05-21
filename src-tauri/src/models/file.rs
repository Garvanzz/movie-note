use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudFile {
    pub id: i64,
    pub code: String,
    pub file_path: String,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub provider: String,
    pub provider_file_id: Option<String>,
    pub provider_url: Option<String>,
    pub provider_meta: Option<String>,
}

/// File entry returned by a provider's list/search operation.
/// Not persisted directly — used as an intermediate representation
/// before the user decides to link a file to a movie.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderFileEntry {
    pub file_id: String,
    pub file_name: String,
    pub file_size: Option<i64>,
    pub file_url: Option<String>,
    pub is_directory: bool,
}
