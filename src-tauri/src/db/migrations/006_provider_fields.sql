-- Add provider columns to files table
-- provider: "local" | "webdav" | "alist" | "115-bridge" | future providers
-- provider_file_id: opaque identifier from the provider (e.g. WebDAV href, inode, rclone remote path)
-- provider_url: openable URL or endpoint for this file (e.g. WebDAV URL, file:// URI)
-- provider_meta: JSON blob for provider-specific metadata (mount point, cookie jar id, etc.)

ALTER TABLE files ADD COLUMN provider TEXT NOT NULL DEFAULT 'local';
ALTER TABLE files ADD COLUMN provider_file_id TEXT;
ALTER TABLE files ADD COLUMN provider_url TEXT;
ALTER TABLE files ADD COLUMN provider_meta TEXT;
