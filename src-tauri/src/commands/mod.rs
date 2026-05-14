pub mod actor;
pub mod data;
pub mod file;
pub mod movie;
pub mod scraper;
pub mod tag;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaginatedResult<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilterOption {
    pub label: String,
    pub value: String,
    pub count: i64,
}
