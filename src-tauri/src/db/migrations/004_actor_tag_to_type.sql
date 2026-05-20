INSERT OR IGNORE INTO actor_categories (name, sort_order)
SELECT t.name,
       COALESCE((SELECT MAX(sort_order) + 1 FROM actor_categories), 0)
FROM tags t
WHERE EXISTS (SELECT 1 FROM actor_tags at WHERE at.tag_id = t.id);

INSERT OR IGNORE INTO actor_category_relations (actor_id, category_id)
SELECT at.actor_id, ac.id
FROM actor_tags at
INNER JOIN tags t ON t.id = at.tag_id
INNER JOIN actor_categories ac ON ac.name = t.name;

DELETE FROM actor_tags;

UPDATE tags SET scope = 'movie';