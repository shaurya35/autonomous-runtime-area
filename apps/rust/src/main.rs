use std::net::SocketAddr;

use axum::Router;
use shop_api::{config::Config, db::AppState, routes};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();

    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_env("LOG_LEVEL"))
        .init();

    let config = Config::from_env()?;
    tracing::info!(port = config.port, "starting shop-api");

    let state = AppState::new(config.clone()).await?;

    sqlx::migrate!("./migrations").run(&state.db).await?;
    tracing::info!("migrations applied");

    // Background task: evict expired session cache entries (pure async — no blocking calls)
    let state_clone = state.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            let mut cache = state_clone.cache.lock().await;
            cache.evict_expired(300);
        }
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app: Router = routes::router().layer(cors).with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!(%addr, "listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
