use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::{auth::jwt::create_token, db::AppState, error::AppError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
}

#[derive(Debug, Deserialize)]
pub struct AuthBody {
    pub email: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: i64,
    pub email: String,
}

async fn register(
    State(state): State<AppState>,
    Json(body): Json<AuthBody>,
) -> Result<(StatusCode, Json<AuthResponse>), AppError> {
    state.inc_requests();

    let email = body
        .email
        .filter(|e| !e.is_empty())
        .ok_or_else(|| AppError::BadRequest("email is required".to_string()))?;

    let password = body
        .password
        .filter(|p| !p.is_empty())
        .ok_or_else(|| AppError::BadRequest("password is required".to_string()))?;

    // Check for existing user
    let existing: Option<i64> = sqlx::query_scalar("SELECT id FROM users WHERE email = ?")
        .bind(&email)
        .fetch_optional(&state.db)
        .await?;

    if existing.is_some() {
        return Err(AppError::BadRequest("email already registered".to_string()));
    }

    // Hash password using spawn_blocking to avoid blocking the async runtime
    let password_hash = tokio::task::spawn_blocking(move || bcrypt::hash(password, bcrypt::DEFAULT_COST))
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let user_id: i64 = sqlx::query_scalar(
        "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id",
    )
    .bind(&email)
    .bind(&password_hash)
    .fetch_one(&state.db)
    .await?;

    let token = create_token(
        user_id,
        &email,
        &state.config.jwt_secret,
        state.config.jwt_expiry_seconds,
    )
    .map_err(|e| AppError::Internal(e))?;

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            token,
            user_id,
            email,
        }),
    ))
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<AuthBody>,
) -> Result<Json<AuthResponse>, AppError> {
    state.inc_requests();

    let email = body
        .email
        .filter(|e| !e.is_empty())
        .ok_or_else(|| AppError::BadRequest("email is required".to_string()))?;

    // Use Option<String> for password — not unwrap
    let password: Option<String> = body.password.filter(|p| !p.is_empty());
    let password = password
        .ok_or_else(|| AppError::BadRequest("password is required".to_string()))?;

    let row = sqlx::query_as::<_, (i64, String)>(
        "SELECT id, password_hash FROM users WHERE email = ?",
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let (user_id, password_hash) = row;

    // Verify password in a blocking thread
    let valid = tokio::task::spawn_blocking(move || bcrypt::verify(password, &password_hash))
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    if !valid {
        return Err(AppError::Unauthorized);
    }

    let token = create_token(
        user_id,
        &email,
        &state.config.jwt_secret,
        state.config.jwt_expiry_seconds,
    )
    .map_err(|e| AppError::Internal(e))?;

    Ok(Json(AuthResponse {
        token,
        user_id,
        email,
    }))
}
