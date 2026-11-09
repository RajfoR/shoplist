from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_token, current_user
from app.db import get_session
from app.models import User
from app.schemas import GuestIn, TokenOut, UserOut

router = APIRouter(tags=["auth"])


@router.post("/auth/guest", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def create_guest(body: GuestIn, session: AsyncSession = Depends(get_session)) -> TokenOut:
    user = User(display_name=body.display_name.strip(), is_guest=True)
    session.add(user)
    await session.commit()
    return TokenOut(access_token=create_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)) -> User:
    return user
