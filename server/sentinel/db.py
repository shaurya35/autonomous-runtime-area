"""SQLite persistence layer.

Opened once at server boot via init_db() and stored on app.state.db.
All public functions take a sqlite3.Connection; callers retrieve it
from app.state.db or pass it directly in tests.
"""
import sqlite3
import time
import uuid
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "sentinel.db"

_SCHEMA = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT    UNIQUE NOT NULL,
        password_hash TEXT    NOT NULL,
        plan          TEXT    NOT NULL DEFAULT 'free',
        created_at    REAL    NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS workspaces (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        name       TEXT    NOT NULL,
        api_key    TEXT    UNIQUE NOT NULL,
        fix_mode   TEXT    NOT NULL DEFAULT 'approve',
        threshold  REAL    NOT NULL DEFAULT 5.0,
        created_at REAL    NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS workspace_apps (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id  INTEGER NOT NULL REFERENCES workspaces(id),
        name          TEXT    NOT NULL,
        health_url    TEXT    NOT NULL DEFAULT '',
        metrics_url   TEXT    NOT NULL DEFAULT '',
        logs_service  TEXT    NOT NULL DEFAULT '',
        connected_at  REAL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pending_patches (
        diff_id      TEXT    PRIMARY KEY,
        run_id       TEXT    NOT NULL,
        workspace_id INTEGER NOT NULL,
        file         TEXT    NOT NULL,
        diff         TEXT    NOT NULL,
        status       TEXT    NOT NULL DEFAULT 'pending',
        created_at   REAL    NOT NULL
    )
    """,
]


def init_db(path: Path = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    for stmt in _SCHEMA:
        conn.execute(stmt)
    conn.commit()
    return conn


# ── users ──────────────────────────────────────────────────────────────────────

def create_user(conn: sqlite3.Connection, email: str, password_hash: str) -> dict:
    conn.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
        (email.lower(), password_hash, time.time()),
    )
    conn.commit()
    return get_user_by_email(conn, email)


def get_user_by_email(conn: sqlite3.Connection, email: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM users WHERE email = ?", (email.lower(),)
    ).fetchone()
    return dict(row) if row else None


def get_user_by_id(conn: sqlite3.Connection, user_id: int) -> dict | None:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


# ── workspaces ─────────────────────────────────────────────────────────────────

def create_workspace(conn: sqlite3.Connection, user_id: int, name: str) -> dict:
    api_key = f"wskey_{uuid.uuid4().hex}"
    conn.execute(
        "INSERT INTO workspaces (user_id, name, api_key, created_at) VALUES (?, ?, ?, ?)",
        (user_id, name, api_key, time.time()),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM workspaces WHERE api_key = ?", (api_key,)
    ).fetchone()
    return dict(row)


def get_workspaces_for_user(conn: sqlite3.Connection, user_id: int) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at",
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_workspace_by_id(conn: sqlite3.Connection, ws_id: int) -> dict | None:
    row = conn.execute("SELECT * FROM workspaces WHERE id = ?", (ws_id,)).fetchone()
    return dict(row) if row else None


def get_workspace_by_api_key(conn: sqlite3.Connection, api_key: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM workspaces WHERE api_key = ?", (api_key,)
    ).fetchone()
    return dict(row) if row else None


def update_workspace(conn: sqlite3.Connection, ws_id: int, **fields) -> None:
    allowed = {"fix_mode", "threshold"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return
    clauses = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(
        f"UPDATE workspaces SET {clauses} WHERE id = ?",
        (*updates.values(), ws_id),
    )
    conn.commit()


# ── workspace_apps ─────────────────────────────────────────────────────────────

def register_workspace_app(
    conn: sqlite3.Connection,
    workspace_id: int,
    name: str,
    health_url: str = "",
    metrics_url: str = "",
    logs_service: str = "",
) -> dict:
    conn.execute(
        """INSERT INTO workspace_apps
           (workspace_id, name, health_url, metrics_url, logs_service)
           VALUES (?, ?, ?, ?, ?)""",
        (workspace_id, name, health_url, metrics_url, logs_service),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM workspace_apps WHERE workspace_id = ? AND name = ?",
        (workspace_id, name),
    ).fetchone()
    return dict(row)


def set_app_connected(conn: sqlite3.Connection, workspace_id: int) -> None:
    conn.execute(
        "UPDATE workspace_apps SET connected_at = ? WHERE workspace_id = ?",
        (time.time(), workspace_id),
    )
    conn.commit()


def set_app_disconnected(conn: sqlite3.Connection, workspace_id: int) -> None:
    conn.execute(
        "UPDATE workspace_apps SET connected_at = NULL WHERE workspace_id = ?",
        (workspace_id,),
    )
    conn.commit()


def get_workspace_apps(conn: sqlite3.Connection, workspace_id: int) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM workspace_apps WHERE workspace_id = ?", (workspace_id,)
    ).fetchall()
    return [dict(r) for r in rows]


# ── pending_patches ────────────────────────────────────────────────────────────

def insert_pending_patch(
    conn: sqlite3.Connection,
    run_id: str,
    workspace_id: int,
    file: str,
    diff: str,
) -> str:
    diff_id = uuid.uuid4().hex
    conn.execute(
        """INSERT INTO pending_patches
           (diff_id, run_id, workspace_id, file, diff, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (diff_id, run_id, workspace_id, file, diff, time.time()),
    )
    conn.commit()
    return diff_id


def get_pending_patch(conn: sqlite3.Connection, diff_id: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM pending_patches WHERE diff_id = ?", (diff_id,)
    ).fetchone()
    return dict(row) if row else None


def update_patch_status(conn: sqlite3.Connection, diff_id: str, status: str) -> None:
    conn.execute(
        "UPDATE pending_patches SET status = ? WHERE diff_id = ?",
        (status, diff_id),
    )
    conn.commit()
