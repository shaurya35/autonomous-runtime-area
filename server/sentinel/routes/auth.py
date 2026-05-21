"""Auth routes: signup, login, logout, /me."""
import os

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from sentinel.auth import (
    SESSION_COOKIE,
    SESSION_MAX_AGE,
    decode_session_token,
    hash_password,
    make_session_token,
    verify_password,
)
from sentinel.db import create_user, get_user_by_email, get_user_by_id

router = APIRouter(prefix="/auth", tags=["auth"])


def _allowed_emails() -> set[str]:
    raw = os.getenv("ALLOWED_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _set_session(response: Response, user_id: int) -> None:
    token = make_session_token(user_id)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,  # flip to True behind HTTPS in production
    )


class AuthBody(BaseModel):
    email: str
    password: str


@router.post("/signup")
def signup(body: AuthBody, request: Request, response: Response):
    email = body.email.strip().lower()
    allowed = _allowed_emails()
    if allowed and email not in allowed:
        raise HTTPException(403, "Email not on the access list. Request access at sentinel.sh/waitlist.")

    db = request.app.state.db
    if get_user_by_email(db, email):
        raise HTTPException(409, "An account with that email already exists.")

    user = create_user(db, email, hash_password(body.password))
    _set_session(response, user["id"])
    return {"id": user["id"], "email": user["email"], "plan": user["plan"]}


@router.post("/login")
def login(body: AuthBody, request: Request, response: Response):
    db = request.app.state.db
    user = get_user_by_email(db, body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password.")
    _set_session(response, user["id"])
    return {"id": user["id"], "email": user["email"], "plan": user["plan"]}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@router.get("/me")
def me(request: Request):
    user = _current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated.")
    return {"id": user["id"], "email": user["email"], "plan": user["plan"]}


# ── shared dependency ──────────────────────────────────────────────────────────

def _current_user(request: Request) -> dict | None:
    """Resolve the logged-in user from cookie or Bearer token (workspace api_key)."""
    db = request.app.state.db

    # 1. Cookie session
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        user_id = decode_session_token(token)
        if user_id:
            return get_user_by_id(db, user_id)

    # 2. Bearer wskey_... (used by the Sentinel agent sidecar and API callers)
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer wskey_"):
        from sentinel.db import get_workspace_by_api_key
        ws = get_workspace_by_api_key(db, auth.removeprefix("Bearer "))
        if ws:
            return get_user_by_id(db, ws["user_id"])

    return None


def require_user(request: Request) -> dict:
    user = _current_user(request)
    if not user:
        raise HTTPException(401, "Authentication required.")
    return user
