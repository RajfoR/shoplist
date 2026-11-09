import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.access import get_list_for_member, is_member, not_found
from app.auth import current_user
from app.db import get_session
from app.models import Item, ListMember, ShoppingList, User, utcnow
from app.realtime import manager
from app.schemas import (
    ItemCreate,
    ItemOut,
    JoinIn,
    ListCreate,
    ListDetail,
    ListOut,
    ListUpdate,
    UserOut,
)

router = APIRouter(tags=["lists"])


async def build_detail(session: AsyncSession, shopping_list: ShoppingList) -> ListDetail:
    items = await session.scalars(
        select(Item).where(Item.list_id == shopping_list.id).order_by(Item.created_at, Item.id)
    )
    members = await session.scalars(
        select(User)
        .join(ListMember, ListMember.user_id == User.id)
        .where(ListMember.list_id == shopping_list.id)
        .order_by(ListMember.joined_at)
    )
    return ListDetail(
        **ListOut.model_validate(shopping_list).model_dump(),
        share_token=shopping_list.share_token,
        items=[ItemOut.model_validate(i) for i in items],
        members=[UserOut.model_validate(m) for m in members],
    )


async def touch_list(session: AsyncSession, list_id: uuid.UUID) -> None:
    await session.execute(
        update(ShoppingList).where(ShoppingList.id == list_id).values(updated_at=utcnow())
    )


@router.get("/lists", response_model=list[ListOut])
async def my_lists(
    user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> list[ShoppingList]:
    result = await session.scalars(
        select(ShoppingList)
        .join(ListMember, ListMember.list_id == ShoppingList.id)
        .where(ListMember.user_id == user.id)
        .order_by(ShoppingList.updated_at.desc())
    )
    return list(result)


@router.post("/lists", response_model=ListDetail, status_code=status.HTTP_201_CREATED)
async def create_list(
    body: ListCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ListDetail:
    shopping_list = ShoppingList(
        name=body.name.strip(), owner_id=user.id, share_token=secrets.token_urlsafe(16)
    )
    session.add(shopping_list)
    await session.flush()
    session.add(ListMember(list_id=shopping_list.id, user_id=user.id))
    await session.commit()
    return await build_detail(session, shopping_list)


@router.post("/lists/join", response_model=ListDetail)
async def join_list(
    body: JoinIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ListDetail:
    shopping_list = await session.scalar(
        select(ShoppingList).where(ShoppingList.share_token == body.share_token)
    )
    if shopping_list is None:
        raise not_found()
    if not await is_member(session, shopping_list.id, user.id):
        session.add(ListMember(list_id=shopping_list.id, user_id=user.id))
        await session.commit()
        await manager.publish(
            shopping_list.id, "member.joined", UserOut.model_validate(user), user.id
        )
    return await build_detail(session, shopping_list)


@router.get("/lists/{list_id}", response_model=ListDetail)
async def get_list(
    list_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ListDetail:
    shopping_list = await get_list_for_member(session, list_id, user.id)
    return await build_detail(session, shopping_list)


@router.patch("/lists/{list_id}", response_model=ListOut)
async def rename_list(
    list_id: uuid.UUID,
    body: ListUpdate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ListOut:
    shopping_list = await get_list_for_member(session, list_id, user.id)
    shopping_list.name = body.name.strip()
    await session.commit()
    out = ListOut.model_validate(shopping_list)
    await manager.publish(list_id, "list.updated", out, user.id)
    return out


@router.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list(
    list_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    shopping_list = await get_list_for_member(session, list_id, user.id)
    if shopping_list.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can delete the list")
    await session.delete(shopping_list)
    await session.commit()
    await manager.publish(list_id, "list.deleted", {"id": str(list_id)}, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/lists/{list_id}/items", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
async def add_item(
    list_id: uuid.UUID,
    body: ItemCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ItemOut:
    await get_list_for_member(session, list_id, user.id)
    quantity = body.quantity.strip() if body.quantity else None
    item = Item(list_id=list_id, name=body.name.strip(), quantity=quantity, created_by=user.id)
    if body.id is not None:
        item.id = body.id
    session.add(item)
    try:
        await session.flush()  # konflikt PK wychodzi tutaj, nie dopiero przy commicie
        await touch_list(session, list_id)
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Item id already exists") from None
    out = ItemOut.model_validate(item)
    await manager.publish(list_id, "item.created", out, user.id)
    return out
