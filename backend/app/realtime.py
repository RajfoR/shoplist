"""Rozgłaszanie eventów i obecność (kto jest online) dla list z otwartym WebSocketem.

Implementacja in-memory: działa przy jednym procesie uvicorna. Żeby skalować
na wiele instancji, `publish` wysyła do Redis pub/sub, a obecność trzyma się
w Redisie z TTL. Interfejs dla routerów się nie zmienia.
"""

import asyncio
import uuid
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket
from pydantic import BaseModel

from app.schemas import UserOut


def _envelope(
    list_id: uuid.UUID, event_type: str, data: BaseModel | dict[str, Any], actor_id: uuid.UUID
) -> dict[str, Any]:
    payload = data.model_dump(mode="json") if isinstance(data, BaseModel) else data
    return {
        "type": event_type,
        "list_id": str(list_id),
        "actor_id": str(actor_id),
        "ts": datetime.now(UTC).isoformat(),
        "data": payload,
    }


class ConnectionManager:
    def __init__(self) -> None:
        # lista → (połączenie → kto jest po drugiej stronie).
        # Jeden użytkownik może mieć kilka połączeń naraz (telefon + laptop).
        self._rooms: dict[uuid.UUID, dict[WebSocket, UserOut]] = defaultdict(dict)

    def online(self, list_id: uuid.UUID) -> list[UserOut]:
        """Kto jest teraz online: każdy użytkownik raz, w kolejności wejścia."""
        unique: dict[uuid.UUID, UserOut] = {}
        for user in self._rooms.get(list_id, {}).values():
            unique.setdefault(user.id, user)
        return list(unique.values())

    def connection_count(self, list_id: uuid.UUID) -> int:
        return len(self._rooms.get(list_id, {}))

    def _is_online(self, list_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return any(u.id == user_id for u in self._rooms.get(list_id, {}).values())

    async def join(self, list_id: uuid.UUID, ws: WebSocket, user: UserOut) -> None:
        # Sprawdzenie i dopisanie bez `await` pomiędzy: w asyncio inne zadanie
        # może wejść tylko na `await`, więc ten fragment jest atomowy.
        first_connection = not self._is_online(list_id, user.id)
        self._rooms[list_id][ws] = user
        if first_connection:
            event = _envelope(list_id, "presence.joined", user, user.id)
            await self._fan_out(list_id, event, exclude=ws)

    async def leave(self, list_id: uuid.UUID, ws: WebSocket) -> None:
        room = self._rooms.get(list_id)
        if room is None:
            return
        user = room.pop(ws, None)
        if not room:
            del self._rooms[list_id]
        # „Wyszedł” ogłaszamy dopiero, gdy zamknął OSTATNIE połączenie.
        if user is not None and not self._is_online(list_id, user.id):
            await self._fan_out(list_id, _envelope(list_id, "presence.left", user, user.id))

    async def publish(
        self,
        list_id: uuid.UUID,
        event_type: str,
        data: BaseModel | dict[str, Any],
        actor_id: uuid.UUID,
    ) -> None:
        await self._fan_out(list_id, _envelope(list_id, event_type, data, actor_id))

    async def _fan_out(
        self, list_id: uuid.UUID, message: dict[str, Any], exclude: WebSocket | None = None
    ) -> None:
        sockets = [ws for ws in self._rooms.get(list_id, {}) if ws is not exclude]
        if not sockets:
            return
        # Równolegle, żeby jeden wolny klient nie blokował reszty. Błędy wysyłki
        # pomijamy: martwe połączenie sprząta jego własna pętla w routers/ws.py
        # (jedno miejsce odpowiada za cykl życia połączenia i za presence.left).
        await asyncio.gather(*(ws.send_json(message) for ws in sockets), return_exceptions=True)


manager = ConnectionManager()
