use crate::db::Database;
use rusqlite::params;
use serde_json::{Map, Value};
use tauri::State;

#[tauri::command]
pub fn export_all_data(db: State<Database>) -> Result<Map<String, Value>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let tables = vec![
        "movies",
        "actors",
        "movie_actors",
        "tags",
        "tag_groups",
        "movie_tags",
        "genres",
        "movie_genres",
        "files",
    ];

    let mut result = Map::new();

    for table in &tables {
        let query = format!("SELECT * FROM {}", table);
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

        let column_names: Vec<String> = stmt
            .column_names()
            .iter()
            .map(|c| c.to_string())
            .collect();

        let rows: Vec<Value> = stmt
            .query_map([], |row| {
                let mut obj = Map::new();
                for (i, col) in column_names.iter().enumerate() {
                    let val: rusqlite::types::Value = row.get_unwrap(i);
                    let json_val = match val {
                        rusqlite::types::Value::Null => Value::Null,
                        rusqlite::types::Value::Integer(i) => Value::Number(i.into()),
                        rusqlite::types::Value::Real(f) => {
                            serde_json::Number::from_f64(f).map(Value::Number).unwrap_or(Value::Null)
                        }
                        rusqlite::types::Value::Text(s) => Value::String(s),
                        rusqlite::types::Value::Blob(_) => Value::Null,
                    };
                    obj.insert(col.clone(), json_val);
                }
                Ok(Value::Object(obj))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        result.insert(table.to_string(), Value::Array(rows));
    }

    Ok(result)
}

#[tauri::command]
pub fn import_all_data(db: State<Database>, data: Map<String, Value>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let ordered_tables = vec![
        "actors", "tags", "tag_groups", "genres", "movies",
        "movie_actors", "movie_tags", "movie_genres", "files",
    ];

    let mut total = 0i64;

    for table in &ordered_tables {
        if let Some(Value::Array(rows)) = data.get(*table) {
            for row in rows {
                if let Value::Object(obj) = row {
                    let columns: Vec<&String> = obj.keys().collect();
                    if columns.is_empty() {
                        continue;
                    }

                    let placeholders: Vec<&str> = vec!["?"; columns.len()];
                    let sql = format!(
                        "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
                        table,
                        columns
                            .iter()
                            .map(|c| c.as_str())
                            .collect::<Vec<_>>()
                            .join(", "),
                        placeholders.join(", ")
                    );

                    let values: Vec<String> = columns
                        .iter()
                        .map(|c| match &obj[*c] {
                            Value::Null => String::new(),
                            Value::String(s) => s.clone(),
                            Value::Number(n) => n.to_string(),
                            _ => String::new(),
                        })
                        .collect();

                    let params: Vec<&dyn rusqlite::types::ToSql> =
                        values.iter().map(|v| v as &dyn rusqlite::types::ToSql).collect();

                    conn.execute(&sql, params.as_slice())
                        .map_err(|e| format!("Import failed for table {}: {}", table, e))?;
                    total += 1;
                }
            }
        }
    }

    Ok(total)
}
