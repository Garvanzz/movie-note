use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MovieCover {
    pub id: i64,
    pub code: String,
    pub image_path: String,
    pub is_primary: bool,
    pub source: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MovieScreenshot {
    pub id: i64,
    pub code: String,
    pub image_path: String,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActorImage {
    pub id: i64,
    pub actor_id: i64,
    pub image_path: String,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedImage {
    pub id: i64,
    pub image_path: String,
}
