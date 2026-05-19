use axum::{
    extract::FromRequestParts,
    http::{request::Parts, HeaderMap},
};

use crate::{auth::jwt::verify_token, db::AppState, error::AppError};

/// Authenticated user, extracted from `Authorization: Bearer <token>` header.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: i64,
    pub email: String,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = extract_bearer_token(&parts.headers).ok_or(AppError::Unauthorized)?;

        let claims =
            verify_token(token, &state.config.jwt_secret).map_err(|_| AppError::Unauthorized)?;

        let user_id: i64 = claims.sub.parse().map_err(|_| AppError::Unauthorized)?;

        Ok(AuthUser {
            user_id,
            email: claims.email,
        })
    }
}

fn extract_bearer_token(headers: &HeaderMap) -> Option<&str> {
    let auth_header = headers.get("Authorization")?.to_str().ok()?;
    auth_header.strip_prefix("Bearer ")
}
