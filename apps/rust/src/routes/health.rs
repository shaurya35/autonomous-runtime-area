use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Serialize;

use crate::db::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/metrics", get(metrics))
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub db: String,
}

async fn healthz(State(state): State<AppState>) -> Response {
    // Actually probe the DB — required for SRE health checks
    let db_ok = sqlx::query_scalar::<_, i64>("SELECT 1")
        .fetch_one(&state.db)
        .await
        .is_ok();

    if db_ok {
        Json(HealthResponse {
            status: "ok".to_string(),
            db: "ok".to_string(),
        })
        .into_response()
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(HealthResponse {
                status: "degraded".to_string(),
                db: "error".to_string(),
            }),
        )
            .into_response()
    }
}

async fn metrics(State(state): State<AppState>) -> String {
    let requests = state.get_requests();
    let errors = state.get_errors();

    format!(
        "# HELP http_requests_total Total HTTP requests\n\
         # TYPE http_requests_total counter\n\
         http_requests_total {requests}\n\
         # HELP errors_total Total errors\n\
         # TYPE errors_total counter\n\
         errors_total {errors}\n"
    )
}
