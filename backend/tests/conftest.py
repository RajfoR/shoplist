import asyncio
import os

# Musi być ustawione przed importem `app`, bo Settings czyta env przy imporcie.
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-use-0123456789")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://shoplist:shoplist@localhost:5432/shoplist_test"
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app import models  # noqa: E402, F401  (rejestruje tabele w metadata)
from app.config import settings  # noqa: E402
from app.db import Base, get_sessionmaker  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    # NullPool: TestClient uruchamia aplikację we własnej pętli zdarzeń, więc nie
    # chcemy, żeby połączenia asyncpg z jednej pętli trafiły do puli innej.
    engine = create_async_engine(settings.database_url, poolclass=NullPool)

    async def reset_schema() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(reset_schema())
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    app.dependency_overrides[get_sessionmaker] = lambda: sessionmaker
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


def make_guest(client: TestClient, name: str) -> dict[str, str]:
    """Zwraca nagłówki z tokenem + pola pomocnicze `_token` i `_id`."""
    res = client.post("/auth/guest", json={"display_name": name})
    assert res.status_code == 201, res.text
    body = res.json()
    return {
        "Authorization": f"Bearer {body['access_token']}",
        "_token": body["access_token"],
        "_id": body["user"]["id"],
    }


def h(guest: dict[str, str]) -> dict[str, str]:
    return {"Authorization": guest["Authorization"]}


@pytest.fixture
def alice(client):
    return make_guest(client, "Alice")


@pytest.fixture
def bob(client):
    return make_guest(client, "Bob")


@pytest.fixture
def shared_list(client, alice, bob):
    """Lista Alice, do której Bob dołączył przez share_token."""
    created = client.post("/lists", json={"name": "Biedronka"}, headers=h(alice)).json()
    res = client.post("/lists/join", json={"share_token": created["share_token"]}, headers=h(bob))
    assert res.status_code == 200
    return created
