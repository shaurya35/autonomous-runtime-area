"""Auth helpers: bcrypt password hashing and signed session cookies.

Session cookie value: itsdangerous-signed JSON → {user_id, exp}.
Cookie name: sentinel_session. HttpOnly, SameSite=lax.
"""
import json
import os
import time

import bcrypt
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

SESSION_COOKIE = "sentinel_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 days

_SECRET_KEY_ENV = "SECRET_KEY"
_DEFAULT_SECRET = "change-me-in-production"


def _signer() -> URLSafeTimedSerializer:
    secret = os.getenv(_SECRET_KEY_ENV, _DEFAULT_SECRET)
    return URLSafeTimedSerializer(secret, salt="sentinel-session")


# ── passwords ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ── sessions ───────────────────────────────────────────────────────────────────

def make_session_token(user_id: int) -> str:
    payload = json.dumps({"user_id": user_id, "created": int(time.time())})
    return _signer().dumps(payload)


def decode_session_token(token: str) -> int | None:
    """Returns user_id, or None if the token is invalid/expired."""
    try:
        payload_str = _signer().loads(token, max_age=SESSION_MAX_AGE)
        payload = json.loads(payload_str)
        return int(payload["user_id"])
    except (BadSignature, SignatureExpired, KeyError, ValueError):
        return None
