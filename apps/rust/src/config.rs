use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiry_seconds: u64,
    pub port: u16,
    pub cors_origin: String,
    pub stripe_api_url: String,
    pub stripe_api_key: String,
    pub log_level: String,
    pub pool_max_connections: u32,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Config {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:./shop.db".to_string()),
            jwt_secret: std::env::var("JWT_SECRET")
                .context("JWT_SECRET environment variable is required")?,
            jwt_expiry_seconds: std::env::var("JWT_EXPIRY_SECONDS")
                .unwrap_or_else(|_| "3600".to_string())
                .parse()
                .context("JWT_EXPIRY_SECONDS must be a valid integer")?,
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .context("PORT must be a valid port number")?,
            cors_origin: std::env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            stripe_api_url: std::env::var("STRIPE_API_URL")
                .unwrap_or_else(|_| "https://api.stripe.com".to_string()),
            stripe_api_key: std::env::var("STRIPE_API_KEY")
                .unwrap_or_else(|_| "sk_test_placeholder".to_string()),
            log_level: std::env::var("LOG_LEVEL")
                .unwrap_or_else(|_| "info".to_string()),
            pool_max_connections: std::env::var("POOL_MAX_CONNECTIONS")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .context("POOL_MAX_CONNECTIONS must be a valid integer")?,
        })
    }
}
