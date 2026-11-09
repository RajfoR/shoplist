import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORM):
    id: uuid.UUID
    display_name: str
    is_guest: bool


class GuestIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=40)


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105
    user: UserOut


class ItemOut(ORM):
    id: uuid.UUID
    list_id: uuid.UUID
    name: str
    quantity: str | None
    checked: bool
    version: int
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ItemCreate(BaseModel):
    # Opcjonalne id generowane przez klienta: optimistic update i event z WS
    # dotyczą wtedy tego samego obiektu, więc nie ma duplikatów ani podmiany id.
    id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=120)
    quantity: str | None = Field(default=None, max_length=40)


class ItemUpdate(BaseModel):
    """Pola pominięte = bez zmian. `quantity: null` = wyczyść ilość."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    quantity: str | None = Field(default=None, max_length=40)
    checked: bool | None = None


class ListOut(ORM):
    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ListDetail(ListOut):
    share_token: str
    items: list[ItemOut]
    members: list[UserOut]


class ListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ListUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class JoinIn(BaseModel):
    share_token: str = Field(min_length=1, max_length=64)
