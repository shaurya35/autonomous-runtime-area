use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::{json, Value};
use tower::ServiceExt;

/// Build a fresh in-memory app state and router for testing.
async fn build_test_app() -> axum::Router {
    // Set required env var for tests
    std::env::set_var("JWT_SECRET", "test-secret-for-integration-tests");
    std::env::set_var("DATABASE_URL", "sqlite::memory:");
    std::env::set_var("LOG_LEVEL", "error");

    let config = shop_api::config::Config::from_env().expect("test config");
    let state = shop_api::db::AppState::new(config)
        .await
        .expect("test state");

    sqlx::migrate!("./migrations")
        .run(&state.db)
        .await
        .expect("migrations");

    shop_api::routes::router()
        .with_state(state)
}

#[tokio::test]
async fn test_health_returns_ok() {
    let app = build_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/healthz")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_value(response).await;
    assert_eq!(body["status"], "ok");
    assert_eq!(body["db"], "ok");
}

#[tokio::test]
async fn test_register_and_login() {
    let app = build_test_app().await;

    // Register
    let reg_response = app
        .clone()
        .oneshot(post_json(
            "/auth/register",
            json!({"email": "test@example.com", "password": "password123"}),
        ))
        .await
        .unwrap();

    assert_eq!(reg_response.status(), StatusCode::CREATED);
    let reg_body = body_to_value(reg_response).await;
    assert!(reg_body["token"].is_string());

    // Login
    let login_response = app
        .oneshot(post_json(
            "/auth/login",
            json!({"email": "test@example.com", "password": "password123"}),
        ))
        .await
        .unwrap();

    assert_eq!(login_response.status(), StatusCode::OK);
    let login_body = body_to_value(login_response).await;
    assert!(login_body["token"].is_string());
}

#[tokio::test]
async fn test_products_list() {
    let app = build_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/products")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_value(response).await;
    let data = body["data"].as_array().unwrap();
    assert!(!data.is_empty(), "products list should not be empty");
}

#[tokio::test]
async fn test_products_pagination_first_page_not_empty() {
    let app = build_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/products?page=1&per_page=3")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_value(response).await;
    let data = body["data"].as_array().unwrap();
    assert_eq!(data.len(), 3, "first page should return 3 items");
    // First product should be id=1 (Widget A)
    assert_eq!(data[0]["id"], 1);
}

#[tokio::test]
async fn test_cart_add_rejects_negative_quantity() {
    let app = build_test_app().await;

    // Register and get token
    let reg_response = app
        .clone()
        .oneshot(post_json(
            "/auth/register",
            json!({"email": "cart_test@example.com", "password": "password123"}),
        ))
        .await
        .unwrap();

    let reg_body = body_to_value(reg_response).await;
    let token = reg_body["token"].as_str().unwrap().to_string();

    // Attempt to add with negative quantity
    let cart_response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/cart/add")
                .header("Content-Type", "application/json")
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::from(
                    serde_json::to_vec(&json!({"product_id": 1, "quantity": -1})).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(
        cart_response.status(),
        StatusCode::UNPROCESSABLE_ENTITY,
        "negative quantity should return 422"
    );
}

// --- helpers ---

fn post_json(uri: &str, body: Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(uri)
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap()
}

async fn body_to_value(response: axum::response::Response) -> Value {
    use http_body_util::BodyExt;
    let bytes = response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    serde_json::from_slice(&bytes).expect("response should be valid JSON")
}
