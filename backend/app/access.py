import uuid

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Item, ListMember, ShoppingList


def not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "Not found")


async def is_member(session: AsyncSession, list_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    stmt = select(exists().where(ListMember.list_id == list_id, ListMember.user_id == user_id))
    return bool(await session.scalar(stmt))


async def get_list_for_member(
    session: AsyncSession, list_id: uuid.UUID, user_id: uuid.UUID
) -> ShoppingList:
    stmt = (
        select(ShoppingList)
        .join(ListMember, ListMember.list_id == ShoppingList.id)
        .where(ShoppingList.id == list_id, ListMember.user_id == user_id)
    )
    shopping_list = await session.scalar(stmt)
    if shopping_list is None:
        raise not_found()
    return shopping_list


async def get_item_for_member(
    session: AsyncSession, item_id: uuid.UUID, user_id: uuid.UUID
) -> Item:
    stmt = (
        select(Item)
        .join(ListMember, ListMember.list_id == Item.list_id)
        .where(Item.id == item_id, ListMember.user_id == user_id)
    )
    item = await session.scalar(stmt)
    if item is None:
        raise not_found()
    return item
