class Policy:
    """Authorization layer — stub for MVP. Always allows."""

    def allow(self, action: str, context: dict | None = None) -> bool:
        return True

    def require_approval(self, action: str, context: dict | None = None) -> bool:
        return False
