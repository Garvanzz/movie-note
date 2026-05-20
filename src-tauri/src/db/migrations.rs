pub struct Migration {
    pub version: i32,
    pub sql: &'static str,
}

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            sql: include_str!("migrations/001_initial.sql"),
        },
        Migration {
            version: 2,
            sql: include_str!("migrations/002_code_search_upgrade.sql"),
        },
        Migration {
            version: 3,
            sql: include_str!("migrations/003_tag_scope.sql"),
        },
        Migration {
            version: 4,
            sql: include_str!("migrations/004_actor_tag_to_type.sql"),
        },
    ]
}
