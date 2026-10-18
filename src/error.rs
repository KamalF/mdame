use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
use std::io;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    Forbidden(&'static str),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    Internal(String),
}

/// The OS text without its " (os error 2)" suffix, which means nothing to
/// a user.
pub fn io_message(error: &io::Error) -> String {
    let text = error.to_string();
    match error.raw_os_error() {
        Some(code) => text
            .strip_suffix(&format!(" (os error {code})"))
            .unwrap_or(&text)
            .to_owned(),
        None => text,
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            ApiError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            ApiError::Forbidden(_) => (StatusCode::FORBIDDEN, "forbidden"),
            ApiError::NotFound(_) => (StatusCode::NOT_FOUND, "not_found"),
            ApiError::Conflict(_) => (StatusCode::CONFLICT, "conflict"),
            ApiError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal"),
        };
        let body = json!({ "error": { "code": code, "message": self.to_string() } });
        (status, Json(body)).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn io_message_drops_the_os_error_number() {
        let missing = std::fs::File::open("/no/such/path").unwrap_err();
        assert_eq!(io_message(&missing), "No such file or directory");
        let ours = io::Error::new(io::ErrorKind::InvalidInput, "not a file or a folder");
        assert_eq!(io_message(&ours), "not a file or a folder");
    }

    #[tokio::test]
    async fn forbidden_has_status_and_json_body() {
        let response = ApiError::Forbidden("origin not allowed").into_response();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(
            body,
            json!({ "error": { "code": "forbidden", "message": "origin not allowed" } })
        );
    }
}
