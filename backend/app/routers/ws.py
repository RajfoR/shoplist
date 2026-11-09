import asyncio
import contextlib
import json
import uuid

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.access import is_member
from app.auth import decode_token
from app.db import get_sessionmaker
from app.realtime import manager

router = APIRouter(tags=["realtime"])

AUTH_TIMEOUT_S = 5
CLOSE_UNAUTHORIZED = 4401
CLOSE_NOT_FOUND = 4404


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

    # Krótka sesja tylko na sprawdzenie członkostwa: nie trzymamy połączenia
    # z bazą przez cały czas życia WebSocketu.
    async with sessionmaker() as session:
        allowed = await is_member(session, list_id, user_id)
    if not allowed:
        await _close(websocket, CLOSE_NOT_FOUND)
        return

    manager.connect(list_id, websocket)
    try:
        await websocket.send_json(
            {"type": "ready", "list_id": str(list_id), "user_id": str(user_id)}
        )
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(msg, dict) and msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(list_id, websocket)
