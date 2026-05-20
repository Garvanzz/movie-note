ALTER TABLE tags ADD COLUMN scope TEXT NOT NULL DEFAULT 'movie';

UPDATE tags
SET scope = 'actor'
WHERE EXISTS (SELECT 1 FROM actor_tags WHERE actor_tags.tag_id = tags.id)
  AND NOT EXISTS (SELECT 1 FROM movie_tags WHERE movie_tags.tag_id = tags.id);

UPDATE tags
SET scope = 'both'
WHERE EXISTS (SELECT 1 FROM actor_tags WHERE actor_tags.tag_id = tags.id)
  AND EXISTS (SELECT 1 FROM movie_tags WHERE movie_tags.tag_id = tags.id);

CREATE INDEX IF NOT EXISTS idx_tags_scope ON tags(scope);