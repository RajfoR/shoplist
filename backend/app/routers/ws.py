import asyncio
import contextlib
import json
import uuid

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.access import is_member
from app.auth import decode_token
from app.db import get_sessionmaker
from app.models import User
from app.realtime import manager
from app.schemas import UserOut

router = APIRouter(tags=["realtime"])

AUTH_TIMEOUT_S = 5
# Klient wysyła ping co 25 s. Przeglądarka w karcie w tle potrafi zwolnić timery
# do 1 na minutę, więc dajemy zapas. Cisza dłużej = połączenie uznajemy za martwe.
IDLE_TIMEOUT_S = 90
CLOSE_UNAUTHORIZED = 4401
CLOSE_NOT_FOUND = 4404
CLOSE_IDLE = 4408


async def _close(ws: WebSocket, code: int) -> None:
    with contextlib.suppress(RuntimeError):  # klient już się rozłączył
        await ws.close(code=code)


async def _authenticate(ws: WebSocket) -> uuid.UUID | None:
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=AUTH_TIMEOUT_S)
        msg = json.loads(raw)
    except (TimeoutError, WebSocketDisconnect, json.JSONDecodeError):
        return None
    if not isinstance(msg, dict) or msg.get("type") != "auth":
        return None
    token = msg.get("token")
    return decode_token(token) if isinstance(token, str) else None


async def _load_member(
    sessionmaker: async_sessionmaker[AsyncSession], list_id: uuid.UUID, user_id: uuid.UUID
) -> UserOut | None:
    # Krótka sesja tylko na sprawdzenie członkostwa: nie trzymamy połączenia
    # z bazą przez cały czas życia WebSocketu.
    async with sessionmaker() as session:
        if not await is_member(session, list_id, user_id):
            return None
        user = await session.get(User, user_id)
        return UserOut.model_validate(user) if user else None


@router.websocket("/ws/lists/{list_id}")
async def list_socket(
    websocket: WebSocket,
    list_id: uuid.UUID,
    sessionmaker: async_sessionmaker[AsyncSession] = Depends(get_sessionmaker),
) -> None:
    await websocket.accept()

    user_id = await _authenticate(websocket)
    if user_id is None:
        await _close(websocket, CLOSE_UNAUTHORIZED)
        return

    user = await _load_member(sessionmaker, list_id, user_id)
    if user is None:
        await _close(websocket, CLOSE_NOT_FOUND)
        return

    await manager.join(list_id, websocket, user)
    try:
        online = [u.model_dump(mode="json") for u in manager.online(list_id)]
        await websocket.send_json(
            {"type": "ready", "list_id": str(list_id), "user_id": str(user_id), "online": online}
        )
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=IDLE_TIMEOUT_S)
            except TimeoutError:
                await _close(websocket, CLOSE_IDLE)  # klient zrobi reconnect
                break
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(msg, dict) and msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await manager.leave(list_id, websocket)
