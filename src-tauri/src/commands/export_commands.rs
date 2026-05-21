use serde_json::{Value, Map, Number};
use tauri::State;
use crate::db::Database;

const ALL_TABLES: [&str; 19] = [
    "movies", "code_aliases", "actors", "actor_names", "actor_aliases",
    "actor_tags", "actor_categories", "actor_category_relations",
    "actor_images", "tags", "tag_groups", "tag_group_items",
    "genres", "movie_actors", "movie_tags", "movie_genres",
    "movie_covers", "movie_screenshots", "files",
];

const CLEAR_ORDER: [&str; 19] = [
    "files", "movie_screenshots", "movie_covers", "movie_genres",
    "movie_tags", "movie_actors", "tag_group_items", "actor_images",
    "actor_category_relations", "actor_tags", "actor_names", "code_aliases", "actor_aliases",
    "movies", "actors", "genres", "tags", "actor_categories", "tag_groups",
];

#[tauri::command]
pub fn export_all_data(db: State<Database>) -> Result<Value, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut root = Map::new();

    for table in &ALL_TABLES {
        let sql = format!("SELECT * FROM {} ORDER BY rowid", table);
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let col_count = stmt.column_count();
        let col_names: Vec<String> = (0..col_count)
            .map(|i| stmt.column_name(i).unwrap_or("?").to_string())
            .collect();

        let rows = stmt.query_map([], |row| {
            let mut obj = Map::new();
            for (i, name) in col_names.iter().enumerate() {
                let val: Value = row.get::<_, rusqlite::types::Value>(i)
                    .map(|v| match v {
                        rusqlite::types::Value::Null => Value::Null,
                        rusqlite::types::Value::Integer(n) => Value::Number(Number::from(n)),
                        rusqlite::types::Value::Real(f) => Number::from_f64(f).map(Value::Number).unwrap_or(Value::Null),
                        rusqlite::types::Value::Text(s) => Value::String(s),
                        rusqlite::types::Value::Blob(_) => Value::Null,
                    })
                    .unwrap_or(Value::Null);
                obj.insert(name.clone(), val);
            }
            Ok(obj)
        }).map_err(|e| e.to_string())?;

        let items: Vec<Value> = rows.collect::<Result<Vec<Map<String, Value>>, _>>().map_err(|e| e.to_string())?
            .into_iter().map(Value::Object).collect();
        root.insert(table.to_string(), Value::Array(items));
    }

    Ok(Value::Object(root))
}

#[tauri::command]
pub fn import_all_data(db: State<Database>, data: Value) -> Result<usize, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let obj = data.as_object().ok_or("Invalid JSON format: expected object")?;
    let mut total = 0usize;

    let ordered_tables = [
        "tags", "genres", "actors", "tag_groups", "actor_categories",
        "movies", "code_aliases", "actor_names", "actor_aliases", "actor_tags",
        "actor_category_relations", "actor_images", "tag_group_items",
        "movie_actors", "movie_tags", "movie_genres",
        "movie_covers", "movie_screenshots", "files",
    ];

    conn.execute("BEGIN", []).map_err(|e| e.to_string())?;

    let result: Result<usize, String> = (|| {
        for table in &ordered_tables {
            let rows = match obj.get(*table) {
                Some(Value::Array(arr)) => arr,
                _ => continue,
            };

            for row in rows {
                let row_obj = row.as_object().ok_or("Expected row object")?;
                let keys: Vec<&str> = row_obj.keys().map(|k| k.as_str()).collect();
                let values: Vec<Value> = keys.iter().map(|k| row_obj[*k].clone()).collect();
                let placeholders: Vec<String> = keys.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();

                let sql = format!(
                    "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
                    table,
                    keys.join(", "),
                    placeholders.join(", "),
                );

                let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
                let refs: Vec<Box<dyn rusqlite::types::ToSql>> = values.iter().map(|v| value_to_sql(v)).collect();
                let param_refs: Vec<&dyn rusqlite::types::ToSql> = refs.iter().map(|b| b.as_ref()).collect();
                stmt.execute(param_refs.as_slice()).map_err(|e| e.to_string())?;
                total += 1;
            }
        }
        Ok(total)
    })();

    match result {
        Ok(n) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(n)
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).map_err(|e2| e2.to_string())?;
            Err(e)
        }
    }
}

#[tauri::command]
pub fn write_json_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_database(db: State<Database>) -> Result<usize, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut total = 0usize;

    conn.execute("BEGIN IMMEDIATE", []).map_err(|e| e.to_string())?;

    let result: Result<usize, String> = (|| {
        for table in &CLEAR_ORDER {
            let sql = format!("DELETE FROM {}", table);
            total += conn.execute(&sql, []).map_err(|e| e.to_string())?;
        }

        conn.execute(
            "DELETE FROM sqlite_sequence WHERE name IN ('movies', 'actors', 'tags', 'tag_groups', 'genres', 'actor_images', 'movie_covers', 'movie_screenshots', 'files', 'actor_categories')",
            [],
        )
        .map_err(|e| e.to_string())?;

        Ok(total)
    })();

    match result {
        Ok(count) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(count)
        }
        Err(error) => {
            conn.execute("ROLLBACK", []).map_err(|e| e.to_string())?;
            Err(error)
        }
    }
}

fn value_to_sql(v: &Value) -> Box<dyn rusqlite::types::ToSql> {
    match v {
        Value::Null => Box::new(None::<String>),
        Value::String(s) => Box::new(s.clone()),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Box::new(i)
            } else if let Some(f) = n.as_f64() {
                if f == f.trunc() && f.abs() < (i64::MAX as f64) {
                    Box::new(f as i64)
                } else {
                    Box::new(f)
                }
            } else {
                Box::new(None::<String>)
            }
        }
        Value::Bool(b) => Box::new(if *b { 1i64 } else { 0i64 }),
        _ => Box::new(None::<String>),
    }
}
