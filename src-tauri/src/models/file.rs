use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudFile {
    pub id: i64,
    pub code: String,
    pub file_path: String,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
}
