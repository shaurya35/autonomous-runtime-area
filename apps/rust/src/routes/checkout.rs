use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};
use serde::Serialize;

use crate::{auth::extractor::AuthUser, db::AppState, error::AppError};

pub fn router() -> Router<AppState> {
    Router::new().route("/checkout", post(checkout))
}

#[derive(Debug, Serialize)]
pub struct CheckoutResponse {
    pub order_id: i64,
    pub total: f64,
    pub status: String,
    pub charge_id: String,
}

async fn checkout(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<(StatusCode, Json<CheckoutResponse>), AppError> {
    state.inc_requests();

    // Fetch cart items with prices
    let items: Vec<(i64, f64)> = sqlx::query_as(
        r#"
        SELECT ci.quantity, p.price
        FROM cart_items ci
        JOIN products p ON p.id = ci.product_id
        WHERE ci.user_id = ?
        "#,
    )
    .bind(auth.user_id)
    .fetch_all(&state.db)
    .await?;

    if items.is_empty() {
        return Err(AppError::BadRequest("cart is empty".to_string()));
    }

    let total: f64 = items.iter().map(|(qty, price)| *qty as f64 * price).sum();
    let amount_cents = (total * 100.0).round() as u64;

    // Call Stripe (stub for test keys, real call for live keys)
    let charge = state
        .stripe
        .create_charge(amount_cents, &format!("Order for user {}", auth.user_id))
        .await
        .map_err(|e| AppError::Internal(e))?;

    // Create order record
    let order_id: i64 = sqlx::query_scalar(
        "INSERT INTO orders (user_id, total, status) VALUES (?, ?, 'paid') RETURNING id",
    )
    .bind(auth.user_id)
    .bind(total)
    .fetch_one(&state.db)
    .await?;

    // Clear the cart
    sqlx::query("DELETE FROM cart_items WHERE user_id = ?")
        .bind(auth.user_id)
        .execute(&state.db)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(CheckoutResponse {
            order_id,
            total,
            status: charge.status,
            charge_id: charge.id,
        }),
    ))
}
