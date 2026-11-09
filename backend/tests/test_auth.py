from tests.conftest import h


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_guest_login_and_me(client, alice):
    res = client.get("/me", headers=h(alice))
    assert res.status_code == 200
    assert res.json()["display_name"] == "Alice"
    assert res.json()["is_guest"] is True


def test_missing_token_is_401(client):
    assert client.get("/me").status_code == 401


def test_garbage_token_is_401(client):
    assert client.get("/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_display_name_validation(client):
    assert client.post("/auth/guest", json={"display_name": ""}).status_code == 422
    assert client.post("/auth/guest", json={"display_name": "x" * 41}).status_code == 422
