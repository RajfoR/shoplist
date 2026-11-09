import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.access import get_item_for_member
from app.auth import current_user
from app.db import get_session
from app.models import User
from app.realtime import manager
from app.routers.lists import touch_list
from app.schemas import ItemOut, ItemUpdate

router = APIRouter(tags=["items"])


@router.patch("/items/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: uuid.UUID,
    body: ItemUpdate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ItemOut:
    item = await get_item_for_member(session, item_id, user.id)
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        item.name = changes["name"].strip()
    if "quantity" in changes:
        item.quantity = changes["quantity"].strip() if changes["quantity"] else None
    if "checked" in changes and changes["checked"] is not None:
        item.checked = changes["checked"]
    item.version += 1
    await touch_list(session, item.list_id)
    await session.commit()
    out = ItemOut.model_validate(item)
    await manager.publish(item.list_id, "item.updated", out, user.id)
    return out


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    item = await get_item_for_member(session, item_id, user.id)
    list_id = item.list_id
    await session.delete(item)
    await touch_list(session, list_id)
    await session.commit()
    await manager.publish(list_id, "item.deleted", {"id": str(item_id)}, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
