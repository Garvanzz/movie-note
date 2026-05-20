ALTER TABLE movies ADD COLUMN code_kind TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE movies ADD COLUMN code_sort_key TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_movies_code_kind ON movies(code_kind);
CREATE INDEX IF NOT EXISTS idx_movies_code_sort_key ON movies(code_sort_key);
CREATE INDEX IF NOT EXISTS idx_actor_aliases_alias ON actor_aliases(alias);
