use tauri::Manager;

mod db;
mod commands;
mod models;
mod code_parser;
mod scraper;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::movie_commands::get_movies,
            commands::movie_commands::suggest_movies,
            commands::movie_commands::get_movie_by_code,
            commands::movie_commands::create_movie,
            commands::movie_commands::update_movie,
            commands::movie_commands::delete_movie,
            commands::movie_commands::get_movie_tags,
            commands::movie_commands::add_movie_tag,
            commands::movie_commands::remove_movie_tag,
            commands::movie_commands::get_movie_filter_options,
            commands::file_commands::get_movie_files,
            commands::file_commands::add_movie_file,
            commands::file_commands::remove_movie_file,
            commands::file_commands::get_movie_actors,
            commands::file_commands::add_movie_actor,
            commands::file_commands::remove_movie_actor,
            commands::actor_commands::get_actors,
            commands::actor_commands::get_actor_categories,
            commands::actor_commands::create_actor_category,
            commands::actor_commands::move_actor_category,
            commands::actor_commands::delete_actor_category,
            commands::actor_commands::get_categories_for_actor,
            commands::actor_commands::add_actor_to_category,
            commands::actor_commands::add_actors_to_category,
            commands::actor_commands::remove_actors_from_category,
            commands::actor_commands::remove_actor_from_category,
            commands::actor_commands::suggest_actors,
            commands::actor_commands::get_actor,
            commands::actor_commands::get_actor_aliases,
            commands::actor_commands::add_actor_alias,
            commands::actor_commands::remove_actor_alias,
            commands::actor_commands::create_actor,
            commands::actor_commands::update_actor,
            commands::actor_commands::delete_actor,
            commands::actor_commands::get_actor_tags,
            commands::actor_commands::add_actor_tag,
            commands::actor_commands::remove_actor_tag,
            commands::tag_commands::get_tags,
            commands::tag_commands::create_tag,
            commands::tag_commands::delete_tag,
            commands::tag_commands::get_tag_groups,
            commands::tag_commands::create_tag_group,
            commands::tag_commands::delete_tag_group,
            commands::tag_commands::get_genres,
            commands::tag_commands::create_genre,
            commands::tag_commands::delete_genre,
            commands::tag_commands::get_movie_genres,
            commands::tag_commands::add_movie_genre,
            commands::tag_commands::remove_movie_genre,
            commands::tag_commands::get_tag_group_items,
            commands::tag_commands::add_tag_to_group,
            commands::tag_commands::remove_tag_from_group,
            commands::scraper_commands::scraper_search,
            commands::scraper_commands::scraper_get_detail,
            commands::scraper_commands::scraper_import,
            commands::export_commands::export_all_data,
            commands::export_commands::import_all_data,
            commands::export_commands::write_json_file,
            commands::export_commands::clear_database,
            commands::workspace_commands::list_workspaces,
            commands::workspace_commands::switch_workspace,
            commands::image_commands::get_movie_covers,
            commands::image_commands::add_movie_cover,
            commands::image_commands::add_movie_cover_from_url,
            commands::image_commands::remove_movie_cover,
            commands::image_commands::set_movie_primary_cover,
            commands::image_commands::get_movie_screenshots,
            commands::image_commands::add_movie_screenshot,
            commands::image_commands::add_movie_screenshot_from_url,
            commands::image_commands::remove_movie_screenshot,
            commands::image_commands::set_actor_avatar,
            commands::image_commands::set_actor_avatar_from_url,
            commands::image_commands::set_actor_avatar_from_image,
            commands::image_commands::remove_actor_avatar,
            commands::image_commands::get_actor_images,
            commands::image_commands::add_actor_image,
            commands::image_commands::add_actor_image_from_url,
            commands::image_commands::remove_actor_image,
            commands::image_commands::save_image_bytes,
            commands::scraper_commands::scraper_download_images,
        ])
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("failed to resolve app dir");
            std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
            let database = db::Database::new(app_dir).expect("failed to open database");
            app.manage(database);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
