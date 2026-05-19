use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct StripeClient {
    pub client: Client,
    pub api_url: String,
    pub api_key: String,
}

#[derive(Debug, Serialize)]
pub struct ChargeRequest {
    pub amount: u64, // in cents
    pub currency: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
pub struct ChargeResponse {
    pub id: String,
    pub status: String,
}

impl StripeClient {
    pub fn new(api_url: &str, api_key: &str) -> Self {
        // Timeout is set here — removing this is SRE-0015 bug injection point
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("failed to build reqwest client");

        StripeClient {
            client,
            api_url: api_url.to_string(),
            api_key: api_key.to_string(),
        }
    }

    /// Create a charge. In non-production environments this returns a stub response.
    pub async fn create_charge(
        &self,
        amount_cents: u64,
        description: &str,
    ) -> Result<ChargeResponse> {
        // Stub: for non-live keys, return a synthetic success without hitting Stripe.
        if self.api_key.starts_with("sk_test_") {
            return Ok(ChargeResponse {
                id: format!("ch_stub_{}", uuid::Uuid::new_v4()),
                status: "succeeded".to_string(),
            });
        }

        let url = format!("{}/v1/charges", self.api_url);
        let params = [
            ("amount", amount_cents.to_string()),
            ("currency", "usd".to_string()),
            ("description", description.to_string()),
        ];

        let response = self
            .client
            .post(&url)
            .bearer_auth(&self.api_key)
            .form(&params)
            .send()
            .await?
            .error_for_status()?
            .json::<ChargeResponse>()
            .await?;

        Ok(response)
    }
}
