use std::cell::RefCell;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::models::ProviderFileEntry;
use crate::providers::FileProvider;

// ── OAuth data structures ──────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceCodeData {
    pub uid: String,
    pub qrcode: String,
    pub time: i64,
    pub sign: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QrCodeStatusData {
    pub status: i32, // 0=waiting, 1=scanned, 2=confirmed
    pub msg: String,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub user_id: String,
    pub user_name: String,
}

// ── API response structures ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ApiResponse<T> {
    #[serde(default)]
    state: bool,
    #[serde(default)]
    code: i32,
    #[serde(default)]
    msg: String,
    #[serde(default)]
    data: Option<T>,
}

#[derive(Debug, Deserialize)]
struct FileInfo {
    #[serde(rename = "fid", default)]
    file_id: String,
    #[serde(rename = "pid", default)]
    parent_id: String,
    #[serde(rename = "fn", default)]
    file_name: String,
    #[serde(rename = "fc", default)]
    file_category: String,
    #[serde(rename = "fs", default)]
    file_size: Option<i64>,
    #[serde(rename = "ico", default)]
    #[allow(dead_code)]
    ico: Option<String>,
    #[serde(rename = "pc", default)]
    pick_code: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct FilesListData {
    #[serde(default)]
    count: i64,
    #[serde(default)]
    path: Vec<PathItem>,
    #[serde(default)]
    data: Vec<FileInfo>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct PathItem {
    #[serde(default)]
    name: String,
    #[serde(default)]
    cid: String,
}

// ── Persistent token store ─────────────────────────────────────────────────

fn token_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("open115_token.json")
}

pub fn load_token(app_data_dir: &PathBuf) -> Option<TokenData> {
    let path = token_path(app_data_dir);
    if !path.exists() {
        return None;
    }
    let data = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&data).ok()
}

pub fn save_token(app_data_dir: &PathBuf, token: &TokenData) -> Result<(), String> {
    let path = token_path(app_data_dir);
    let data = serde_json::to_string_pretty(token)
        .map_err(|e| format!("Failed to serialize token: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("Failed to write token: {}", e))
}

pub fn delete_token(app_data_dir: &PathBuf) -> Result<(), String> {
    let path = token_path(app_data_dir);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to remove token: {}", e))?;
    }
    Ok(())
}

// ── 115 Open API provider ─────────────────────────────────────────────────

const BASE_URL: &str = "https://open.115.com";

struct TokenState {
    access_token: Option<String>,
    refresh_token: Option<String>,
    token_expires_at: Option<i64>,
}

pub struct Open115Provider {
    name: String,
    client_id: String,
    token_state: RefCell<TokenState>,
    app_data_dir: PathBuf,
    http_client: reqwest::blocking::Client,
}

impl Open115Provider {
    pub fn new(name: &str, client_id: &str, app_data_dir: PathBuf) -> Self {
        let (access_token, refresh_token, token_expires_at) =
            if let Some(token) = load_token(&app_data_dir) {
                let now = now_secs();
                if token.expires_at > now + 300 {
                    (Some(token.access_token), Some(token.refresh_token), Some(token.expires_at))
                } else if !token.refresh_token.is_empty() {
                    (None, Some(token.refresh_token), None)
                } else {
                    (None, None, None)
                }
            } else {
                (None, None, None)
            };

        Self {
            name: name.to_string(),
            client_id: client_id.to_string(),
            token_state: RefCell::new(TokenState {
                access_token,
                refresh_token,
                token_expires_at,
            }),
            app_data_dir,
            http_client: reqwest::blocking::Client::new(),
        }
    }

    // ── Public helpers ─────────────────────────────────────────────────

    pub fn is_authenticated(&self) -> bool {
        let state = self.token_state.borrow();
        state.access_token.is_some()
    }

    // ── OAuth flow (static methods called from commands) ──────────────────

    pub fn start_device_code(client_id: &str) -> Result<DeviceCodeData, String> {
        let code_verifier = generate_code_verifier();
        let code_challenge = sha256_base64(&code_verifier);

        let client = reqwest::blocking::Client::new();
        let resp = client
            .post(format!("{}/passport/token", BASE_URL))
            .form(&[
                ("client_id", client_id),
                ("code_challenge", &code_challenge),
                ("code_challenge_method", "sha256"),
            ])
            .send()
            .map_err(|e| format!("Device code request failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("Auth failed: {} (code: {})", resp_data.msg, resp_data.code));
        }

        let data = resp_data.data.ok_or("No data in device code response")?;
        let uid = data["uid"].as_str().unwrap_or("").to_string();
        let qrcode = data["qrcode"].as_str().unwrap_or("").to_string();
        let time = data["time"].as_i64().unwrap_or(0);
        let sign = data["sign"].as_str().unwrap_or("").to_string();

        let combined_uid = format!("{}|{}", uid, code_verifier);

        Ok(DeviceCodeData { uid: combined_uid, qrcode, time, sign })
    }

    pub fn poll_qrcode_status(uid: &str, time: i64, sign: &str) -> Result<QrCodeStatusData, String> {
        let real_uid = uid.split('|').next().unwrap_or(uid);

        let client = reqwest::blocking::Client::new();
        let resp = client
            .get(format!("{}/passport/status", BASE_URL))
            .query(&[
                ("uid", real_uid),
                ("time", &time.to_string()),
                ("sign", sign),
            ])
            .send()
            .map_err(|e| format!("Status request failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse status: {}, body: {}", e, truncate(&body, 300)))?;

        let status = resp_data
            .data
            .as_ref()
            .and_then(|d| d["status"].as_i64())
            .unwrap_or(-1) as i32;
        let msg = resp_data
            .data
            .as_ref()
            .and_then(|d| d["msg"].as_str())
            .unwrap_or("")
            .to_string();

        Ok(QrCodeStatusData { status, msg, version: None })
    }

    pub fn exchange_token(
        client_id: &str,
        uid_with_verifier: &str,
        app_data_dir: &PathBuf,
    ) -> Result<TokenData, String> {
        let parts: Vec<&str> = uid_with_verifier.splitn(2, '|').collect();
        let real_uid = parts[0];
        let code_verifier = parts.get(1).unwrap_or(&"");

        if code_verifier.is_empty() {
            return Err("Missing code verifier — restart auth flow".to_string());
        }

        let client = reqwest::blocking::Client::new();
        let resp = client
            .post(format!("{}/passport/code_to_token", BASE_URL))
            .form(&[
                ("client_id", client_id),
                ("uid", real_uid),
                ("code_verifier", code_verifier),
            ])
            .send()
            .map_err(|e| format!("Token exchange failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse token: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("Token exchange: {} (code: {})", resp_data.msg, resp_data.code));
        }

        let data = resp_data.data.ok_or("No token data")?;
        let access_token = data["access_token"].as_str().unwrap_or("").to_string();
        let refresh_token = data["refresh_token"].as_str().unwrap_or("").to_string();
        let expires_in = data["expires_in"].as_i64().unwrap_or(7200);

        let token = TokenData {
            access_token,
            refresh_token,
            expires_at: now_secs() + expires_in,
        };

        save_token(app_data_dir, &token)?;
        Ok(token)
    }

    // ── Token management ───────────────────────────────────────────────────

    fn ensure_token(&self) -> Result<String, String> {
        let now = now_secs();
        {
            let state = self.token_state.borrow();
            if let (Some(token), Some(expires_at)) = (&state.access_token, state.token_expires_at) {
                if expires_at > now + 60 {
                    return Ok(token.clone());
                }
            }
        }

        // Need refresh
        self.do_refresh()?;
        let state = self.token_state.borrow();
        state.access_token.clone().ok_or("No token after refresh".to_string())
    }

    fn do_refresh(&self) -> Result<(), String> {
        let refresh = {
            let state = self.token_state.borrow();
            state.refresh_token.clone().ok_or("No refresh token")?
        };

        let resp = self
            .http_client
            .post(format!("{}/passport/refresh_token", BASE_URL))
            .form(&[("refresh_token", &refresh)])
            .send()
            .map_err(|e| format!("Token refresh failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse refresh: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            {
                let mut state = self.token_state.borrow_mut();
                state.access_token = None;
                state.refresh_token = None;
                state.token_expires_at = None;
            }
            let _ = delete_token(&self.app_data_dir);
            return Err("Session expired. Please scan QR code again.".to_string());
        }

        let data = resp_data.data.ok_or("No refresh data")?;
        let access_token = data["access_token"].as_str().unwrap_or("").to_string();
        let refresh_token = data["refresh_token"].as_str().unwrap_or("").to_string();
        let expires_in = data["expires_in"].as_i64().unwrap_or(7200);

        let now = now_secs();
        {
            let mut state = self.token_state.borrow_mut();
            state.access_token = Some(access_token.clone());
            state.refresh_token = Some(refresh_token.clone());
            state.token_expires_at = Some(now + expires_in);
        }

        let token = TokenData {
            access_token,
            refresh_token,
            expires_at: now + expires_in,
        };
        save_token(&self.app_data_dir, &token)?;

        Ok(())
    }

    // ── API helpers ────────────────────────────────────────────────────────

    fn api_get<T: for<'de> Deserialize<'de> + Default>(
        &self,
        path: &str,
        params: &[(&str, &str)],
    ) -> Result<T, String> {
        let token = self.ensure_token()?;
        let resp = self
            .http_client
            .get(format!("{}{}", BASE_URL, path))
            .query(params)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .map_err(|e| format!("API request failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let result: ApiResponse<T> = serde_json::from_str(&body).map_err(|e| {
            format!("Parse API response: {}, body: {}", e, truncate(&body, 300))
        })?;

        if !result.state {
            return Err(format!("API error: {}", result.msg));
        }

        result.data.ok_or("No data in API response".to_string())
    }

    fn api_post<T: for<'de> Deserialize<'de> + Default>(
        &self,
        path: &str,
        form: &[(&str, &str)],
    ) -> Result<T, String> {
        let token = self.ensure_token()?;
        let resp = self
            .http_client
            .post(format!("{}{}", BASE_URL, path))
            .form(form)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .map_err(|e| format!("API request failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let result: ApiResponse<T> = serde_json::from_str(&body).map_err(|e| {
            format!("Parse API response: {}, body: {}", e, truncate(&body, 300))
        })?;

        if !result.state {
            return Err(format!("API error: {}", result.msg));
        }

        result.data.ok_or("No data in API response".to_string())
    }

    // ── File operations ────────────────────────────────────────────────────

    pub fn get_user_info(&self) -> Result<UserInfo, String> {
        #[derive(Deserialize, Default)]
        struct UserData {
            #[serde(rename = "user_id", default)]
            user_id: String,
            #[serde(rename = "user_name", default)]
            user_name: String,
        }
        let user: UserData = self.api_get("/api/user/info", &[])?;
        Ok(UserInfo { user_id: user.user_id, user_name: user.user_name })
    }

    fn list_files_internal(&self, cid: &str) -> Result<FilesListData, String> {
        let limit = "100";
        let offset = "0";
        self.api_get(
            "/api/fs/files",
            &[
                ("cid", cid),
                ("limit", limit),
                ("offset", offset),
                ("show_dir", "1"),
                ("asc", "0"),
                ("o", "user_utime"),
            ],
        )
    }

    fn search_files_api(&self, keyword: &str, limit: i64, offset: i64) -> Result<Vec<ProviderFileEntry>, String> {
        #[derive(Deserialize)]
        struct SearchFile {
            #[serde(rename = "file_id", default)]
            file_id: String,
            #[serde(rename = "file_name", default)]
            file_name: String,
            #[serde(rename = "file_size", default)]
            file_size: String,
            #[serde(rename = "file_category", default)]
            file_category: String,
            #[serde(rename = "pick_code", default)]
            pick_code: Option<String>,
        }

        #[derive(Deserialize, Default)]
        struct SearchData {
            #[serde(default)]
            data: Vec<SearchFile>,
        }

        let l = limit.to_string();
        let o = offset.to_string();
        let result: SearchData = self.api_get(
            "/api/fs/search",
            &[
                ("search_value", keyword),
                ("cid", "0"),
                ("limit", &l),
                ("offset", &o),
            ],
        )?;

        Ok(result
            .data
            .into_iter()
            .map(|f| ProviderFileEntry {
                file_id: f.pick_code.clone().unwrap_or_else(|| f.file_id.clone()),
                file_name: f.file_name,
                file_size: f.file_size.parse().ok(),
                file_url: f.pick_code.map(|pc| format!("115://file/{}", pc)),
                is_directory: f.file_category == "0",
            })
            .collect())
    }

    fn get_down_url(&self, pick_code: &str) -> Result<String, String> {
        let token = self.ensure_token()?;
        let resp = self
            .http_client
            .post(format!("{}/api/fs/down_url", BASE_URL))
            .form(&[("pick_code", pick_code)])
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "Mozilla/5.0")
            .send()
            .map_err(|e| format!("DownURL request failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse down_url: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("DownURL error: {}", resp_data.msg));
        }

        let data = resp_data.data.ok_or("No data")?;
        let entry = data
            .get(pick_code)
            .ok_or(format!("No entry for pick_code: {}", pick_code))?;
        let url = entry["url"]["url"].as_str().unwrap_or("");
        if url.is_empty() {
            return Err("No URL in response".to_string());
        }
        Ok(url.to_string())
    }

    pub fn mkdir(&self, pid: &str, name: &str) -> Result<String, String> {
        let token = self.ensure_token()?;
        let resp = self.http_client
            .post(format!("{}/api/fs/mkdir", BASE_URL))
            .form(&[("pid", pid), ("file_name", name)])
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .map_err(|e| format!("Mkdir failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse mkdir: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("Mkdir error: {}", resp_data.msg));
        }

        let data = resp_data.data.ok_or("No data")?;
        Ok(data["file_id"].as_str().unwrap_or("").to_string())
    }

    pub fn rename(&self, file_id: &str, new_name: &str) -> Result<(), String> {
        let token = self.ensure_token()?;
        let resp = self.http_client
            .post(format!("{}/api/fs/update", BASE_URL))
            .form(&[("file_id", file_id), ("file_name", new_name)])
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .map_err(|e| format!("Rename failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse rename: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("Rename error: {}", resp_data.msg));
        }
        Ok(())
    }

    pub fn delete_files(&self, file_ids: &str, parent_id: &str) -> Result<(), String> {
        let token = self.ensure_token()?;
        let resp = self.http_client
            .post(format!("{}/api/fs/delete", BASE_URL))
            .form(&[("file_ids", file_ids), ("parent_id", parent_id)])
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .map_err(|e| format!("Delete failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse delete: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("Delete error: {}", resp_data.msg));
        }
        Ok(())
    }

    pub fn move_files(&self, file_ids: &str, to_cid: &str) -> Result<(), String> {
        let token = self.ensure_token()?;
        let resp = self.http_client
            .post(format!("{}/api/fs/move", BASE_URL))
            .form(&[("file_ids", file_ids), ("to_cid", to_cid)])
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .map_err(|e| format!("Move failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse move: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("Move error: {}", resp_data.msg));
        }
        Ok(())
    }

    pub fn copy_files(&self, file_ids: &str, pid: &str) -> Result<(), String> {
        let token = self.ensure_token()?;
        let resp = self.http_client
            .post(format!("{}/api/fs/copy", BASE_URL))
            .form(&[("file_id", file_ids), ("pid", pid)])
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .map_err(|e| format!("Copy failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse copy: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("Copy error: {}", resp_data.msg));
        }
        Ok(())
    }

    /// Get file/folder stat info.
    pub fn stat(&self, file_id: &str) -> Result<serde_json::Value, String> {
        let token = self.ensure_token()?;
        let resp = self.http_client
            .get(format!("{}/api/fs/file", BASE_URL))
            .query(&[("file_id", file_id)])
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .map_err(|e| format!("Stat request failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse stat: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("Stat error: {}", resp_data.msg));
        }
        resp_data.data.ok_or("No stat data".to_string())
    }

    /// List recycle bin.
    pub fn rb_list(&self, limit: i64, offset: i64) -> Result<serde_json::Value, String> {
        let l = limit.to_string();
        let o = offset.to_string();
        let token = self.ensure_token()?;
        let resp = self.http_client
            .get(format!("{}/api/fs/rb_list", BASE_URL))
            .query(&[("limit", &l), ("offset", &o)])
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .map_err(|e| format!("Rb list failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse rb_list: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("Rb list error: {}", resp_data.msg));
        }
        Ok(resp_data.data.unwrap_or(serde_json::json!({})))
    }

    /// Restore files from recycle bin.
    pub fn rb_revert(&self, tid: &str) -> Result<(), String> {
        let token = self.ensure_token()?;
        let resp = self.http_client
            .post(format!("{}/api/fs/rb_revert", BASE_URL))
            .form(&[("tid", tid)])
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .map_err(|e| format!("Rb revert failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse rb_revert: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("Rb revert error: {}", resp_data.msg));
        }
        Ok(())
    }

    /// Permanently delete files from recycle bin.
    pub fn rb_delete(&self, tid: &str) -> Result<(), String> {
        let token = self.ensure_token()?;
        let resp = self.http_client
            .post(format!("{}/api/fs/rb_delete", BASE_URL))
            .form(&[("tid", tid)])
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .map_err(|e| format!("Rb delete failed: {}", e))?;

        let body = resp.text().map_err(|e| format!("Read response: {}", e))?;
        let resp_data: ApiResponse<serde_json::Value> =
            serde_json::from_str(&body)
                .map_err(|e| format!("Parse rb_delete: {}, body: {}", e, truncate(&body, 300)))?;

        if !resp_data.state {
            return Err(format!("Rb delete error: {}", resp_data.msg));
        }
        Ok(())
    }

    fn file_info_to_entry(&self, info: &FileInfo) -> ProviderFileEntry {
        let is_dir = info.file_category == "0";
        let file_id = info.pick_code.clone()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| info.file_id.clone());

        let file_url = if is_dir {
            None
        } else if let Some(pc) = &info.pick_code {
            if pc.is_empty() {
                None
            } else {
                Some(format!("115://file/{}", pc))
            }
        } else {
            None
        };

        ProviderFileEntry {
            file_id,
            file_name: info.file_name.clone(),
            file_size: info.file_size,
            file_url,
            is_directory: is_dir,
        }
    }
}

impl FileProvider for Open115Provider {
    fn name(&self) -> &str {
        &self.name
    }

    fn search(&self, code: &str) -> Result<Vec<ProviderFileEntry>, String> {
        self.search_files_api(code, 100, 0)
    }

    fn list(&self, path: &str) -> Result<Vec<ProviderFileEntry>, String> {
        let cid = if path.is_empty() { "0" } else { path };
        let result = self.list_files_internal(cid)?;
        let entries: Vec<ProviderFileEntry> = result
            .data
            .iter()
            .map(|f| self.file_info_to_entry(f))
            .collect();
        Ok(entries)
    }

    fn open(&self, file_id: &str) -> Result<(), String> {
        let url = self.resolve_playback_url(file_id)?;
        opener::open(&url).map_err(|e| format!("Failed to open: {}", e))
    }

    fn resolve_playback_url(&self, file_id: &str) -> Result<String, String> {
        let pick_code = if let Some(stripped) = file_id.strip_prefix("115://file/") {
            stripped
        } else {
            file_id
        };

        if pick_code.is_empty() {
            return Err("Invalid file ID".to_string());
        }

        self.get_down_url(pick_code)
    }
}

// ── PKCE helpers ──────────────────────────────────────────────────────────

fn generate_code_verifier() -> String {
    use rand::Rng;
    let chars: Vec<u8> =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~".to_vec();
    let mut rng = rand::thread_rng();
    (0..64)
        .map(|_| chars[rng.gen_range(0..chars.len())] as char)
        .collect()
}

fn sha256_base64(input: &str) -> String {
    use base64::Engine;
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    base64::engine::general_purpose::STANDARD.encode(hasher.finalize())
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}
