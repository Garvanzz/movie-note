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
        let clean_path = path.trim_start_matches('/');
        format!("{}/{}", self.endpoint, clean_path)
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
            return Err(format!("PROPFIND returned {}: {}", status, truncate_str(&text, 200)));
        }

        parse_propfind_response(&text, &self.endpoint)
    }

    /// Construct a direct-access URL for a file (for playback).
    fn file_url(&self, href: &str) -> String {
        if href.starts_with("http") {
            href.to_string()
        } else {
            let clean = href.trim_start_matches('/');
            format!("{}/{}", self.endpoint, clean)
        }
    }
}

impl FileProvider for WebdavProvider {
    fn name(&self) -> &str {
        &self.name
    }

    fn search(&self, code: &str) -> Result<Vec<ProviderFileEntry>, String> {
        // PROPFIND depth 1 under the root to find directories/files matching the code.
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

/// Minimal PROPFIND XML response parser.
/// Extracts href, displayname, contentlength, and resourcetype (collection vs file).
fn parse_propfind_response(xml: &str, base_url: &str) -> Result<Vec<ProviderFileEntry>, String> {
    // Simple XML parsing without a full DOM library.
    // We extract <d:response> blocks using string operations.
    let mut entries = Vec::new();

    let responses: Vec<&str> = xml.split("<d:response>").skip(1).collect();

    for block in responses {
        let block = match block.split("</d:response>").next() {
            Some(b) => b,
            None => continue,
        };

        let href = extract_xml_value(block, "d:href");
        let displayname = extract_xml_value(block, "d:displayname");
        let content_length_str = extract_xml_value(block, "d:getcontentlength");
        let is_collection = block.contains("<d:collection") || block.contains("<d:collection/>");

        // Skip the root collection itself
        let href_clean = href.trim_end_matches('/');
        let base_clean = base_url.trim_end_matches('/');
        if href_clean.is_empty() || href_clean == base_clean {
            continue;
        }

        let file_name = if !displayname.is_empty() {
            displayname
        } else {
            // Extract filename from href
            let segments: Vec<&str> = href.split('/').filter(|s| !s.is_empty()).collect();
            segments.last().map(|s| s.to_string()).unwrap_or_default()
        };

        let file_size: Option<i64> = content_length_str.parse().ok();

        let file_url = if href.starts_with("http") {
            href.clone()
        } else {
            let clean = href.trim_start_matches('/');
            format!("{}/{}", base_url.trim_end_matches('/'), clean)
        };

        entries.push(ProviderFileEntry {
            file_id: href.clone(),
            file_name,
            file_size,
            file_url: Some(file_url),
            is_directory: is_collection,
        });
    }

    // Sort: directories first, then alphabetical
    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()))
    });

    Ok(entries)
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

    // Self-closing or absent
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
        let entries = parse_propfind_response(&xml, "https://dav.example.com").unwrap();

        // 4 entries: root dir /dav/, Movies dir, IPX-123.mp4, SSIS-456.mkv
        assert_eq!(entries.len(), 4);

        // Root directory
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

        let entries = parse_propfind_response(xml, "https://example.com").unwrap();
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

        let entries = parse_propfind_response(xml, "https://example.com").unwrap();
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
