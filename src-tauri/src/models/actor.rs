use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Actor {
    pub id: i64,
    pub name: String,
    pub name_jp: Option<String>,
    pub measurements: Option<String>,
    pub birth_date: Option<String>,
    pub debut_year: Option<i32>,
    pub rating: Option<f64>,
    pub comment: Option<String>,
    pub avatar_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActorCategory {
    pub id: i64,
    pub name: String,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActorName {
    pub id: i64,
    pub actor_id: i64,
    pub name: String,
    pub kind: String,
    pub is_primary: bool,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActorSuggestion {
    pub id: i64,
    pub name: String,
    pub name_jp: Option<String>,
    pub matched_name: String,
    pub match_kind: String,
}
