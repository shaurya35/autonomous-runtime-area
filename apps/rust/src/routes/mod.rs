pub mod auth;
pub mod cart;
pub mod checkout;
pub mod health;
pub mod products;

use axum::Router;

use crate::db::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .merge(auth::router())
        .merge(products::router())
        .merge(cart::router())
        .merge(checkout::router())
        .merge(health::router())
}
