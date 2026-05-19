use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::{db::AppState, error::AppError, models::Product};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/products", get(list_products))
        .route("/products/{id}", get(get_product))
}

#[derive(Debug, Deserialize)]
pub struct Pagination {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_per_page")]
    pub per_page: i64,
}

fn default_page() -> i64 {
    1
}

fn default_per_page() -> i64 {
    10
}

#[derive(Debug, Serialize)]
pub struct ProductsResponse {
    pub data: Vec<Product>,
    pub page: i64,
    pub per_page: i64,
    pub total: i64,
}

async fn list_products(
    State(state): State<AppState>,
    Query(pagination): Query<Pagination>,
) -> Result<Json<ProductsResponse>, AppError> {
    state.inc_requests();

    let page = pagination.page.max(1);
    let per_page = pagination.per_page.clamp(1, 100);

    // Correct formula: offset = (page - 1) * per_page (page is 1-indexed)
    let offset = (page - 1) * per_page;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM products")
        .fetch_one(&state.db)
        .await?;

    let products = sqlx::query_as::<_, Product>(
        "SELECT id, name, description, price, stock, created_at FROM products ORDER BY id LIMIT ? OFFSET ?",
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(ProductsResponse {
        data: products,
        page,
        per_page,
        total,
    }))
}

async fn get_product(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Product>, AppError> {
    state.inc_requests();

    let product = sqlx::query_as::<_, Product>(
        "SELECT id, name, description, price, stock, created_at FROM products WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("product {} not found", id)))?;

    Ok(Json(product))
}
