"""Rozgłaszanie eventów do klientów WebSocket podłączonych do danej listy.

Implementacja in-memory: działa przy jednym procesie uvicorna. Żeby skalować
na wiele instancji, `publish` wysyła do Redis pub/sub, a osobny task
subskrybuje kanał i woła `_fan_out` lokalnie. Interfejs dla routerów się nie zmienia.
"""

import asyncio
import uuid
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket
from pydantic import BaseModel


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)

    def connect(self, list_id: uuid.UUID, ws: WebSocket) -> None:
        self._rooms[list_id].add(ws)

    def disconnect(self, list_id: uuid.UUID, ws: WebSocket) -> None:
        room = self._rooms.get(list_id)
        if room is None:
            return
        room.discard(ws)
        if not room:
            del self._rooms[list_id]

    def connection_count(self, list_id: uuid.UUID) -> int:
        return len(self._rooms.get(list_id, ()))

    async def publish(
        self,
        list_id: uuid.UUID,
        event_type: str,
        data: BaseModel | dict[str, Any],
        actor_id: uuid.UUID,
    ) -> None:
        payload = data.model_dump(mode="json") if isinstance(data, BaseModel) else data
        message = {
            "type": event_type,
            "list_id": str(list_id),
            "actor_id": str(actor_id),
            "ts": datetime.now(UTC).isoformat(),
            "data": payload,
        }
        await self._fan_out(list_id, message)

    async def _fan_out(self, list_id: uuid.UUID, message: dict[str, Any]) -> None:
        sockets = list(self._rooms.get(list_id, ()))
        if not sockets:
            return
        # Równolegle, żeby jeden wolny klient nie blokował reszty.
        results = await asyncio.gather(
            *(ws.send_json(message) for ws in sockets), return_exceptions=True
        )
        for ws, result in zip(sockets, results, strict=True):
            if isinstance(result, Exception):
                self.disconnect(list_id, ws)


manager = ConnectionManager()
