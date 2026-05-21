"""Workspace routes: create, list, register apps, events SSE."""
import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from sentinel.db import (
    create_workspace,
    get_workspace_by_id,
    get_workspace_apps,
    get_workspaces_for_user,
    register_workspace_app,
    update_workspace,
)
from sentinel.routes.auth import require_user

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class CreateWorkspaceBody(BaseModel):
    name: str


class RegisterAppBody(BaseModel):
    name: str
    health_url: str = ""
    metrics_url: str = ""
    logs_service: str = ""


class UpdateWorkspaceBody(BaseModel):
    fix_mode: str | None = None
    threshold: float | None = None


@router.post("")
def create_ws(body: CreateWorkspaceBody, request: Request):
    user = require_user(request)
    db = request.app.state.db
    ws = create_workspace(db, user["id"], body.name)
    return _ws_out(ws)


@router.get("")
def list_ws(request: Request):
    user = require_user(request)
    db = request.app.state.db
    workspaces = get_workspaces_for_user(db, user["id"])
    return [_ws_out(w) for w in workspaces]


@router.get("/{ws_id}")
def get_ws(ws_id: int, request: Request):
    user = require_user(request)
    db = request.app.state.db
    ws = _require_ws(db, ws_id, user["id"])
    return _ws_out(ws)


@router.patch("/{ws_id}")
def update_ws(ws_id: int, body: UpdateWorkspaceBody, request: Request):
    user = require_user(request)
    db = request.app.state.db
    ws = _require_ws(db, ws_id, user["id"])
    fields = {}
    if body.fix_mode is not None:
        if body.fix_mode not in ("approve", "auto"):
            raise HTTPException(400, "fix_mode must be 'approve' or 'auto'")
        fields["fix_mode"] = body.fix_mode
    if body.threshold is not None:
        fields["threshold"] = body.threshold
    update_workspace(db, ws["id"], **fields)
    return _ws_out(get_workspace_by_id(db, ws["id"]))


@router.post("/{ws_id}/apps")
def register_app(ws_id: int, body: RegisterAppBody, request: Request):
    user = require_user(request)
    db = request.app.state.db
    ws = _require_ws(db, ws_id, user["id"])
    app_row = register_workspace_app(
        db, ws["id"], body.name,
        health_url=body.health_url,
        metrics_url=body.metrics_url,
        logs_service=body.logs_service,
    )
    return dict(app_row)


@router.get("/{ws_id}/apps")
def list_apps(ws_id: int, request: Request):
    user = require_user(request)
    db = request.app.state.db
    ws = _require_ws(db, ws_id, user["id"])
    return get_workspace_apps(db, ws["id"])


@router.get("/{ws_id}/events")
async def workspace_events(ws_id: int, request: Request):
    """SSE stream of workspace-level events (agent connected/disconnected).

    Used by the onboarding wizard's 'Waiting for agent…' step.
    """
    user = require_user(request)
    db = request.app.state.db
    _require_ws(db, ws_id, user["id"])

    # Each workspace has a broadcast queue stored in app.state.ws_events
    events_map: dict[int, asyncio.Queue] = request.app.state.ws_events
    if ws_id not in events_map:
        events_map[ws_id] = asyncio.Queue(maxsize=100)
    q = events_map[ws_id]

    async def generator() -> AsyncIterator[dict]:
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=30)
                yield {"data": json.dumps(event)}
                if event.get("kind") == "agent_connected":
                    break
            except asyncio.TimeoutError:
                yield {"data": json.dumps({"kind": "ping"})}

    return EventSourceResponse(generator())


# ── helpers ───────────────────────────────────────────────────────────────────

def _require_ws(db, ws_id: int, user_id: int) -> dict:
    ws = get_workspace_by_id(db, ws_id)
    if not ws or ws["user_id"] != user_id:
        raise HTTPException(404, "Workspace not found.")
    return ws


def _ws_out(ws: dict) -> dict:
    return {
        "id": ws["id"],
        "name": ws["name"],
        "api_key": ws["api_key"],
        "fix_mode": ws["fix_mode"],
        "threshold": ws["threshold"],
        "created_at": ws["created_at"],
    }
