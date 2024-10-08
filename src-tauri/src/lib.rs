use tauri_plugin_sql::{Builder, Migration, MigrationKind};

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    let migrations = vec![
        // 「移動」の集合としての「旅行」
        Migration {
            version: 1,
            description: "create_travel_tables",
            sql: "CREATE TABLE travel (id: TEXT PRIMARY KEY, name TEXT, description TEXT);",
            kind: MigrationKind::Up,
        },
        // 連続した位置の移動記録としての「移動」
        Migration {
            version: 1,
            description: "create_move_tables",
            sql: "CREATE TABLE move (move_id: TEXT PRIMARY KEY, start_timestamp: TEXT, end_timestamp: TEXT);",
            kind: MigrationKind::Up,
        },
        // GPS等で取得した位置
        Migration {
            version: 1,
            description: "create_geolocation_tables",
            sql: "CREATE TABLE geolocation (timestamp: TEXT PRIMARY KEY, latitude: REAL, longitude: REAL);",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
            .add_migrations("sqlite:overmoveTest.db", migrations)
            .build()
        )
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_geolocation::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
