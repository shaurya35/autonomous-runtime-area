use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

use sqlx::SqlitePool;
use tokio::sync::Mutex;

use crate::cache::SessionCache;
use crate::config::Config;
use crate::integrations::stripe::StripeClient;

/// Shared application state threaded through Axum extractors.
#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub cache: Arc<Mutex<SessionCache>>,
    pub config: Arc<Config>,
    pub stripe: Arc<StripeClient>,

    // Prometheus-style counters
    pub requests_total: Arc<AtomicU64>,
    pub errors_total: Arc<AtomicU64>,
}

impl AppState {
    pub async fn new(config: Config) -> anyhow::Result<Self> {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(config.pool_max_connections)
            .connect(&config.database_url)
            .await?;

        let stripe = StripeClient::new(&config.stripe_api_url, &config.stripe_api_key);

        Ok(AppState {
            db: pool,
            cache: Arc::new(Mutex::new(SessionCache::new())),
            stripe: Arc::new(stripe),
            config: Arc::new(config),
            requests_total: Arc::new(AtomicU64::new(0)),
            errors_total: Arc::new(AtomicU64::new(0)),
        })
    }

    pub fn inc_requests(&self) {
        self.requests_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_errors(&self) {
        self.errors_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn get_requests(&self) -> u64 {
        self.requests_total.load(Ordering::Relaxed)
    }

    pub fn get_errors(&self) -> u64 {
        self.errors_total.load(Ordering::Relaxed)
    }
}
