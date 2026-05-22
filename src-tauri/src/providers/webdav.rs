use crate::models::ProviderFileEntry;
use crate::providers::FileProvider;

/// WebDAV bridge provider.
///
/// Connects to any WebDAV-compatible endpoint (rclone serve, AList, 115drive-webdav, etc.)
/// for searching, listing, and resolving playback URLs.
///
/// The current implementation serves as a bridge layer — file search/list goes through
/// the WebDAV endpoint, while playback uses the resolved URL (which the player opens directly).
pub struct WebdavProvider {
    name: String,
    endpoint: String,
    username: Option<String>,
    password: Option<String>,
}

impl WebdavProvider {
    pub fn new(name: &str, endpoint: &str, username: Option<&str>, password: Option<&str>) -> Self {
        Self {
            name: name.to_string(),
            endpoint: endpoint.trim_end_matches('/').to_string(),
            username: username.map(|s| s.to_string()),
            password: password.map(|s| s.to_string()),
        }
    }

    /// Build an HTTP URL for a PROPFIND request.
    fn propfind_url(&self, path: &str) -> String {
        build_full_url(&self.endpoint, path)
    }

    /// Send a PROPFIND request and parse the XML response into file entries.
    fn propfind(&self, path: &str, depth: &str) -> Result<Vec<ProviderFileEntry>, String> {
        let url = self.propfind_url(path);
        let client = reqwest::blocking::Client::new();
        let mut req = client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
            .header("Depth", depth);

        if let (Some(u), Some(p)) = (&self.username, &self.password) {
            req = req.basic_auth(u, Some(p));
        }

        let body = r#"<?xml version="1.0" encoding="utf-8"?>
	<d:propfind xmlns:d="DAV:">
	  <d:prop>
	    <d:displayname/>
	    <d:getcontentlength/>
	    <d:getlastmodified/>
	    <d:resourcetype/>
	  </d:prop>
	</d:propfind>"#;

        let resp = req
            .body(body)
            .send()
            .map_err(|e| format!("PROPFIND request failed: {}", e))?;

        let status = resp.status();
        let text = resp.text().map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            let hint = match status.as_u16() {
                404 => format!("地址不存在: {}\nAList 需在后台开启 WebDAV，且端点以 /dav 结尾", url),
                401 | 403 => "需要用户名密码，请在连接配置中填写 AList 的 WebDAV 账号".to_string(),
                _ => format!("HTTP {}", status),
            };
            return Err(format!("{}: {}", hint, truncate_str(&text, 200)));
        }

        // If the response doesn't look like XML, the endpoint is likely wrong
        if !text.trim_start().starts_with("<?xml") && !text.contains("<d:multistatus") && !text.contains("<D:multistatus") {
            let preview = truncate_str(&text, 150);
            return Err(format!(
                "服务器返回的不是 WebDAV 响应，请确认端点地址是否正确。\n响应预览: {}",
                preview
            ));
        }

        parse_propfind_response(&text, &self.endpoint, path)
    }

    /// Construct a direct-access URL for a file (for playback).
    fn file_url(&self, href: &str) -> String {
        build_full_url(&self.endpoint, href)
    }
}

impl FileProvider for WebdavProvider {
    fn name(&self) -> &str {
        &self.name
    }

    fn search(&self, code: &str) -> Result<Vec<ProviderFileEntry>, String> {
        let all = self.propfind("", "1")?;
        let code_lower = code.to_lowercase();
        let matches: Vec<ProviderFileEntry> = all
            .into_iter()
            .filter(|entry| entry.file_name.to_lowercase().contains(&code_lower))
            .collect();
        Ok(matches)
    }

    fn list(&self, path: &str) -> Result<Vec<ProviderFileEntry>, String> {
        self.propfind(path, "1")
    }

    fn open(&self, file_id: &str) -> Result<(), String> {
        let url = self.file_url(file_id);
        opener::open(&url).map_err(|e| format!("Failed to open URL: {}", e))
    }

    fn resolve_playback_url(&self, file_id: &str) -> Result<String, String> {
        Ok(self.file_url(file_id))
    }
}

// ── URL helper ─────────────────────────────────────────────────────────────

/// Build a full URL from an endpoint base and a path.
/// Prevents path duplication when the relative path already contains
/// the endpoint's path prefix (e.g. endpoint=/dav + path=/dav/115 → /dav/115).
fn build_full_url(endpoint: &str, path: &str) -> String {
    if path.starts_with("http") {
        return path.to_string();
    }
    if path.is_empty() {
        return endpoint.to_string();
    }

    // Extract the path component from endpoint (e.g. "/dav" from "http://x/dav")
    let ep_path = endpoint
        .split("://")
        .nth(1)
        .and_then(|host_and_path| host_and_path.find('/'))
        .map(|i| {
            let after_scheme = &endpoint[endpoint.find("://").unwrap() + 3..];
            &after_scheme[i..]
        })
        .unwrap_or("");

    // If the incoming path already starts with the endpoint path, strip that prefix
    let relative = if !ep_path.is_empty() && path.starts_with(ep_path) {
        &path[ep_path.len()..]
    } else {
        path
    };

    let clean = relative.trim_start_matches('/');
    let has_trailing = path.ends_with('/');
    if clean.is_empty() && !has_trailing {
        return endpoint.to_string();
    }
    if clean.is_empty() && has_trailing {
        return format!("{}/", endpoint);
    }
    let suffix = if has_trailing && !clean.ends_with('/') { "/" } else { "" };
    format!("{}/{}{}", endpoint, clean, suffix)
}

// ── XML parser ─────────────────────────────────────────────────────────────

/// Minimal PROPFIND XML response parser.
fn parse_propfind_response(xml: &str, base_url: &str, current_path: &str) -> Result<Vec<ProviderFileEntry>, String> {
    // Normalize namespace prefixes to lowercase
    let normalized = xml
        .replace("<D:", "<d:")
        .replace("</D:", "</d:")
        .replace("<DAV:", "<d:")
        .replace("</DAV:", "</d:");

    let mut entries = Vec::new();
    let responses: Vec<&str> = normalized.split("<d:response>").skip(1).collect();

    for block in responses {
        let block = match block.split("</d:response>").next() {
            Some(b) => b,
            None => continue,
        };

        let href = extract_xml_value(block, "d:href");
        let displayname = extract_xml_value(block, "d:displayname");
        let content_length_str = extract_xml_value(block, "d:getcontentlength");
        let is_collection = block.contains("<d:collection");

        // Skip the root collection
        if is_root_collection(&href, base_url) {
            continue;
        }

        // Skip the directory itself (self-reference in PROPFIND response)
        // e.g. when listing /dav/115/, skip entry with href=/dav/115/
        if !current_path.is_empty() && is_same_entry(&href, current_path) {
            continue;
        }

        let file_name = if !displayname.is_empty() {
            displayname
        } else {
            href.split('/').filter(|s| !s.is_empty()).last()
                .map(|s| s.to_string())
                .unwrap_or_default()
        };

        let file_size: Option<i64> = content_length_str.parse().ok();
        let file_url = build_full_url(base_url, &href);

        entries.push(ProviderFileEntry {
            file_id: href.clone(),
            file_name,
            file_size,
            file_url: Some(file_url),
            is_directory: is_collection,
        });
    }

    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()))
    });

    Ok(entries)
}

/// Check if href and path refer to the same entry (for filtering self-references).
fn is_same_entry(href: &str, path: &str) -> bool {
    let href_clean = href.trim_end_matches('/');
    let path_clean = path.trim_end_matches('/');
    href_clean == path_clean || href_clean.ends_with(path_clean)
}

/// Check if an href represents the root collection (should be skipped).
fn is_root_collection(href: &str, base_url: &str) -> bool {
    let href_clean = href.trim_end_matches('/');
    if href_clean.is_empty() || href_clean == "/" {
        return true;
    }
    // Extract path from base_url and compare
    let base_path = base_url
        .split("://")
        .nth(1)
        .and_then(|s| s.find('/'))
        .map(|i| &base_url[base_url.find("://").unwrap() + 3 + i..])
        .unwrap_or("");
    href_clean == base_path || href_clean == base_path.trim_end_matches('/')
}

fn extract_xml_value(xml: &str, tag: &str) -> String {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);

    if let Some(start) = xml.find(&open) {
        let after_open = &xml[start + open.len()..];
        if let Some(end) = after_open.find(&close) {
            return after_open[..end].to_string();
        }
    }

    String::new()
}

fn truncate_str(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_url_prevents_double_path() {
        assert_eq!(
            build_full_url("http://localhost:5244/dav", "/dav/115/"),
            "http://localhost:5244/dav/115/"
        );
        assert_eq!(
            build_full_url("http://localhost:5244/dav", "/dav/"),
            "http://localhost:5244/dav/"
        );
        assert_eq!(
            build_full_url("http://localhost:5244/dav", "/dav/foo.mp4"),
            "http://localhost:5244/dav/foo.mp4"
        );
    }

    #[test]
    fn build_url_handles_simple_paths() {
        assert_eq!(
            build_full_url("https://example.com", "/files/video.mp4"),
            "https://example.com/files/video.mp4"
        );
        assert_eq!(
            build_full_url("https://example.com/dav", ""),
            "https://example.com/dav"
        );
    }

    fn sample_propfind_response() -> String {
        r#"<?xml version="1.0" encoding="utf-8"?>
	<d:multistatus xmlns:d="DAV:">
	  <d:response>
	    <d:href>/dav/</d:href>
	    <d:propstat>
	      <d:prop>
	        <d:displayname>/dav/</d:displayname>
	        <d:resourcetype><d:collection/></d:resourcetype>
	      </d:prop>
	      <d:status>HTTP/1.1 200 OK</d:status>
	    </d:propstat>
	  </d:response>
	  <d:response>
	    <d:href>/dav/Movies/</d:href>
	    <d:propstat>
	      <d:prop>
	        <d:displayname>Movies</d:displayname>
	        <d:resourcetype><d:collection/></d:resourcetype>
	      </d:prop>
	      <d:status>HTTP/1.1 200 OK</d:status>
	    </d:propstat>
	  </d:response>
	  <d:response>
	    <d:href>/dav/IPX-123.mp4</d:href>
	    <d:propstat>
	      <d:prop>
	        <d:displayname>IPX-123.mp4</d:displayname>
	        <d:getcontentlength>2147483648</d:getcontentlength>
	        <d:getlastmodified>Mon, 15 Jan 2024 12:00:00 GMT</d:getlastmodified>
	        <d:resourcetype/>
	      </d:prop>
	      <d:status>HTTP/1.1 200 OK</d:status>
	    </d:propstat>
	  </d:response>
	  <d:response>
	    <d:href>/dav/SSIS-456.mkv</d:href>
	    <d:propstat>
	      <d:prop>
	        <d:displayname>SSIS-456.mkv</d:displayname>
	        <d:getcontentlength>5368709120</d:getcontentlength>
	        <d:resourcetype/>
	      </d:prop>
	      <d:status>HTTP/1.1 200 OK</d:status>
	    </d:propstat>
	  </d:response>
	</d:multistatus>"#.to_string()
    }

    #[test]
    fn parse_propfind_extracts_files_and_dirs() {
        let xml = sample_propfind_response();
        let entries = parse_propfind_response(&xml, "https://dav.example.com", "").unwrap();

        // Root dir /dav/ should NOT be skipped here (endpoint has no /dav path)
        assert_eq!(entries.len(), 4);

        // First entry is the root dir /dav/
        let root_dir = &entries[0];
        assert!(root_dir.is_directory);
        assert!(root_dir.file_name.contains("dav"));

        // Movies directory
        let movies = &entries[1];
        assert!(movies.is_directory);
        assert_eq!(movies.file_name, "Movies");
        assert_eq!(movies.file_url.as_deref(), Some("https://dav.example.com/dav/Movies/"));

        // IPX-123.mp4
        let ipx = &entries[2];
        assert!(!ipx.is_directory);
        assert_eq!(ipx.file_name, "IPX-123.mp4");
        assert_eq!(ipx.file_size, Some(2_147_483_648));

        // SSIS-456.mkv
        let ssis = &entries[3];
        assert!(!ssis.is_directory);
        assert_eq!(ssis.file_name, "SSIS-456.mkv");
        assert_eq!(ssis.file_size, Some(5_368_709_120));
    }

    #[test]
    fn parse_propfind_skips_root_when_base_url_has_path() {
        let xml = sample_propfind_response();
        // endpoint is http://localhost:5244/dav, so base_url = "http://localhost:5244/dav"
        // href=/dav/ matches endpoint path, should be skipped
        let entries = parse_propfind_response(&xml, "http://localhost:5244/dav", "").unwrap();
        assert_eq!(entries.len(), 3); // root skipped
        assert_eq!(entries[0].file_url.as_deref(), Some("http://localhost:5244/dav/Movies/"));
    }

    #[test]
    fn parse_propfind_falls_back_to_href_filename() {
        let xml = r#"<?xml version="1.0"?>
	<d:multistatus xmlns:d="DAV:">
	  <d:response>
	    <d:href>/files/video.mp4</d:href>
	    <d:propstat>
	      <d:prop>
	        <d:displayname></d:displayname>
	        <d:getcontentlength>1000</d:getcontentlength>
	        <d:resourcetype/>
	      </d:prop>
	      <d:status>HTTP/1.1 200 OK</d:status>
	    </d:propstat>
	  </d:response>
	</d:multistatus>"#;

        let entries = parse_propfind_response(xml, "https://example.com", "").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].file_name, "video.mp4");
    }

    #[test]
    fn parse_propfind_skips_root_collection() {
        let xml = r#"<?xml version="1.0"?>
	<d:multistatus xmlns:d="DAV:">
	  <d:response>
	    <d:href>/</d:href>
	    <d:propstat>
	      <d:prop>
	        <d:displayname>/</d:displayname>
	        <d:resourcetype><d:collection/></d:resourcetype>
	      </d:prop>
	      <d:status>HTTP/1.1 200 OK</d:status>
	    </d:propstat>
	  </d:response>
	</d:multistatus>"#;

        let entries = parse_propfind_response(xml, "https://example.com", "").unwrap();
        assert!(entries.is_empty(), "root collection should be skipped");
    }

    #[test]
    fn extract_xml_value_finds_nested_tags() {
        let xml = r#"<d:prop><d:displayname>test.mp4</d:displayname><d:getcontentlength>42</d:getcontentlength></d:prop>"#;
        assert_eq!(extract_xml_value(xml, "d:displayname"), "test.mp4");
        assert_eq!(extract_xml_value(xml, "d:getcontentlength"), "42");
    }

    #[test]
    fn extract_xml_value_returns_empty_for_missing_tag() {
        assert_eq!(extract_xml_value("<root/>", "d:missing"), "");
    }
}
