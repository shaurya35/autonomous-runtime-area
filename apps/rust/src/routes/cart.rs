use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::{
    auth::extractor::AuthUser,
    db::AppState,
    error::AppError,
    models::CartItem,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/cart", get(get_cart))
        .route("/cart/add", post(add_to_cart))
        .route("/cart/{item_id}", delete(remove_from_cart))
}

#[derive(Debug, Deserialize)]
pub struct AddToCartBody {
    pub product_id: Option<i64>,
    pub quantity: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct CartResponse {
    pub items: Vec<CartItemWithProduct>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CartItemWithProduct {
    pub id: i64,
    pub product_id: i64,
    pub quantity: i64,
    pub name: String,
    pub price: f64,
}

async fn get_cart(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<CartResponse>, AppError> {
    state.inc_requests();

    let items = sqlx::query_as::<_, CartItemWithProduct>(
        r#"
        SELECT ci.id, ci.product_id, ci.quantity, p.name, p.price
        FROM cart_items ci
        JOIN products p ON p.id = ci.product_id
        WHERE ci.user_id = ?
        ORDER BY ci.id
        "#,
    )
    .bind(auth.user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(CartResponse { items }))
}

async fn add_to_cart(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<AddToCartBody>,
) -> Result<(StatusCode, Json<CartItem>), AppError> {
    state.inc_requests();

    let product_id = body
        .product_id
        .ok_or_else(|| AppError::BadRequest("product_id is required".to_string()))?;

    let quantity = body
        .quantity
        .ok_or_else(|| AppError::BadRequest("quantity is required".to_string()))?;

    // Validate: quantity must be positive
    if quantity <= 0 {
        return Err(AppError::UnprocessableEntity(
            "quantity must be greater than 0".to_string(),
        ));
    }

    // Verify product exists
    let product_exists: Option<i64> = sqlx::query_scalar("SELECT id FROM products WHERE id = ?")
        .bind(product_id)
        .fetch_optional(&state.db)
        .await?;

    if product_exists.is_none() {
        return Err(AppError::NotFound(format!(
            "product {} not found",
            product_id
        )));
    }

    // Upsert: if item already exists, add quantity
    let item_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO cart_items (user_id, product_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, product_id)
        DO UPDATE SET quantity = quantity + excluded.quantity
        RETURNING id
        "#,
    )
    .bind(auth.user_id)
    .bind(product_id)
    .bind(quantity)
    .fetch_one(&state.db)
    .await?;

    let item = sqlx::query_as::<_, CartItem>(
        "SELECT id, user_id, product_id, quantity FROM cart_items WHERE id = ?",
    )
    .bind(item_id)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(item)))
}

async fn remove_from_cart(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(item_id): Path<i64>,
) -> Result<StatusCode, AppError> {
    state.inc_requests();

    let result = sqlx::query(
        "DELETE FROM cart_items WHERE id = ? AND user_id = ?",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "cart item {} not found",
            item_id
        )));
    }

    Ok(StatusCode::NO_CONTENT)
}
