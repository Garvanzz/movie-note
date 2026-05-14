mod commands;
mod db;

use db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            let database =
                Database::new(app_data_dir).expect("failed to initialize database");
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::movie::get_movies,
            commands::movie::get_movie_by_code,
            commands::movie::create_movie,
            commands::movie::update_movie,
            commands::movie::delete_movie,
            commands::movie::get_movie_tags,
            commands::movie::add_movie_tag,
            commands::movie::remove_movie_tag,
            commands::movie::get_movie_filter_options,
            commands::actor::get_actors,
            commands::actor::get_actor,
            commands::actor::create_actor,
            commands::actor::update_actor,
            commands::actor::delete_actor,
            commands::tag::get_tags,
            commands::tag::create_tag,
            commands::tag::delete_tag,
            commands::tag::get_tag_groups,
            commands::tag::create_tag_group,
            commands::tag::get_genres,
            commands::tag::create_genre,
            commands::tag::delete_genre,
            commands::file::get_movie_files,
            commands::file::add_movie_file,
            commands::file::remove_movie_file,
            commands::scraper::scraper_search,
            commands::scraper::scraper_get_detail,
            commands::scraper::scraper_import,
            commands::data::export_all_data,
            commands::data::import_all_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
