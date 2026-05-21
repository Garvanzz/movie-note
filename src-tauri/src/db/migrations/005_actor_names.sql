CREATE TABLE IF NOT EXISTS actor_names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'alias'
        CHECK(kind IN ('native','japanese','romanized','translated','stage','alias')),
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(actor_id, name)
);

CREATE INDEX IF NOT EXISTS idx_actor_names_actor ON actor_names(actor_id);
CREATE INDEX IF NOT EXISTS idx_actor_names_name ON actor_names(name);

INSERT OR IGNORE INTO actor_names (actor_id, name, kind, is_primary, sort_order)
SELECT id, trim(name), 'native', 1, 0
FROM actors
WHERE trim(name) <> '';

INSERT OR IGNORE INTO actor_names (actor_id, name, kind, is_primary, sort_order)
SELECT id, trim(name_jp), 'japanese', 0, 1
FROM actors
WHERE name_jp IS NOT NULL
  AND trim(name_jp) <> ''
  AND lower(trim(name_jp)) <> lower(trim(name));

INSERT OR IGNORE INTO actor_names (actor_id, name, kind, is_primary, sort_order)
SELECT aa.actor_id, trim(aa.alias), 'alias', 0, aa.id + 10
FROM actor_aliases aa
INNER JOIN actors a ON a.id = aa.actor_id
WHERE trim(aa.alias) <> ''
  AND lower(trim(aa.alias)) <> lower(trim(a.name))
  AND lower(trim(aa.alias)) <> lower(trim(COALESCE(a.name_jp, '')));
