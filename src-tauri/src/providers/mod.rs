pub mod config;
pub mod local;
pub mod open115;
pub mod webdav;

use crate::models::ProviderFileEntry;

/// Unified interface that every file provider must implement.
pub trait FileProvider {
    /// Human-readable provider name, e.g. "local", "webdav", "alist".
    fn name(&self) -> &str;

    /// Search for files matching a movie code under the provider root.
    fn search(&self, code: &str) -> Result<Vec<ProviderFileEntry>, String>;

    /// List files under a given provider path (directory).
    fn list(&self, path: &str) -> Result<Vec<ProviderFileEntry>, String>;

    /// Open a file with the system default handler.
    fn open(&self, file_id: &str) -> Result<(), String>;

    /// Resolve a playback-ready URL for the given file.
    /// For local files this may be a `file://` URI;
    /// for WebDAV it's an HTTP URL with optional auth.
    fn resolve_playback_url(&self, file_id: &str) -> Result<String, String>;
}
