use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Movie {
    pub code: String,
    pub code_norm: String,
    pub series: Option<String>,
    pub title: Option<String>,
    pub title_jp: Option<String>,
    pub runtime: Option<i32>,
    pub release_date: Option<String>,
    pub rating: Option<f64>,
    pub comment: Option<String>,
    pub notes: Option<String>,
    pub watch_status: String,
    pub cover_path: Option<String>,
    pub source_url: Option<String>,
    pub source_site: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MovieSuggestion {
    pub code: String,
    pub title: Option<String>,
    pub release_date: Option<String>,
    pub match_kind: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MovieFilter {
    pub search: Option<String>,
    pub tag_ids: Option<Vec<i64>>,
    pub actor_ids: Option<Vec<i64>>,
    pub genre_ids: Option<Vec<i64>>,
    pub series: Option<String>,
    pub rating_min: Option<f64>,
    pub rating_max: Option<f64>,
    pub watch_status: Option<String>,
    pub has_files: Option<bool>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
}
