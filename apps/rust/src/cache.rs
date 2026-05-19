use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct CachedSession {
    pub user_id: i64,
    pub email: String,
    pub created_at: u64,
}

#[derive(Debug, Default)]
pub struct SessionCache {
    inner: HashMap<String, CachedSession>,
}

impl SessionCache {
    pub fn new() -> Self {
        SessionCache {
            inner: HashMap::new(),
        }
    }

    pub fn insert(&mut self, token: String, session: CachedSession) {
        self.inner.insert(token, session);
    }

    pub fn get(&self, token: &str) -> Option<&CachedSession> {
        self.inner.get(token)
    }

    pub fn remove(&mut self, token: &str) {
        self.inner.remove(token);
    }

    /// Remove entries older than ttl_seconds. Called periodically by background task.
    pub fn evict_expired(&mut self, ttl_seconds: u64) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        self.inner.retain(|_, session| {
            now.saturating_sub(session.created_at) < ttl_seconds
        });
    }

    pub fn len(&self) -> usize {
        self.inner.len()
    }
}
