"""Approve-before-apply flow for workspace incidents.

When workspace.fix_mode == 'approve', propose_patch() does NOT immediately
apply the diff to the user's repo. Instead it:

1. Stores the diff in the DB (pending_patches table).
2. Emits a `pending_approval` channel event so the dashboard shows a card.
3. Creates an asyncio.Future keyed on diff_id and awaits it.
4. Returns when the user approves (future resolves with the apply result)
   or rejects (future resolves with {"rejected": True}).

The approve / reject HTTP endpoints in main.py resolve these futures.

app.state.pending_futures: dict[diff_id, asyncio.Future]
"""
import asyncio
import logging

log = logging.getLogger(__name__)


class PendingPatchStore:
    """Holds in-flight approval futures keyed by diff_id."""

    def __init__(self):
        self._futures: dict[str, asyncio.Future] = {}

    def create(self, diff_id: str) -> asyncio.Future:
        loop = asyncio.get_event_loop()
        fut: asyncio.Future = loop.create_future()
        self._futures[diff_id] = fut
        return fut

    def resolve(self, diff_id: str, result: dict) -> bool:
        fut = self._futures.pop(diff_id, None)
        if fut and not fut.done():
            fut.set_result(result)
            return True
        return False

    def reject(self, diff_id: str) -> bool:
        return self.resolve(diff_id, {"rejected": True, "error": "rejected by user"})

    def cancel_all_for_run(self, run_id: str, db) -> None:
        from sentinel.db import get_pending_patch
        # This is a best-effort cleanup; futures may already be resolved
        pass
