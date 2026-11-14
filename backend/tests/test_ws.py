import pytest
from starlette.websockets import WebSocketDisconnect

from app.routers import ws as ws_router
from tests.conftest import h, make_guest


def auth(ws, guest):
    """Autoryzuje otwarte połączenie i zwraca wiadomość `ready`."""
    ws.send_json({"type": "auth", "token": guest["_token"]})
    return ws.receive_json()


def disconnect(ws):
    """Zamyka połączenie od strony klienta i daje serwerowi to obsłużyć.

    Samo wyjście z `with` w TestClient od razu anuluje zadanie serwera, więc
    `presence.left` mogłoby nie zdążyć wyjść. Pod uvicornem tego problemu nie ma.
    """
    ws.close(1000)


def names(ready):
    return [u["display_name"] for u in ready["online"]]


def test_member_receives_events_from_other_member(client, alice, bob, shared_list):
    list_id = shared_list["id"]
    with client.websocket_connect(f"/ws/lists/{list_id}") as ws:
        ws.send_json({"type": "auth", "token": bob["_token"]})
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        assert ready["list_id"] == list_id
        assert ready["user_id"] == bob["_id"]

        item = client.post(
            f"/lists/{list_id}/items", json={"name": "Kawa"}, headers=h(alice)
        ).json()
        event = ws.receive_json()
        assert event["type"] == "item.created"
        assert event["actor_id"] == alice["_id"]
        assert event["data"]["id"] == item["id"]
        assert event["data"]["version"] == 1

        client.patch(f"/items/{item['id']}", json={"checked": True}, headers=h(alice))
        event = ws.receive_json()
        assert event["type"] == "item.updated"
        assert event["data"]["checked"] is True
        assert event["data"]["version"] == 2

        client.delete(f"/items/{item['id']}", headers=h(alice))
        event = ws.receive_json()
        assert event == {**event, "type": "item.deleted", "data": {"id": item["id"]}}


def test_new_member_join_is_broadcast(client, alice, shared_list):
    list_id = shared_list["id"]
    with client.websocket_connect(f"/ws/lists/{list_id}") as ws:
        ws.send_json({"type": "auth", "token": alice["_token"]})
        ws.receive_json()  # ready
        carol = make_guest(client, "Carol")
        client.post(
            "/lists/join", json={"share_token": shared_list["share_token"]}, headers=h(carol)
        )
        event = ws.receive_json()
        assert event["type"] == "member.joined"
        assert event["data"]["display_name"] == "Carol"


def test_ping_pong(client, alice, shared_list):
    with client.websocket_connect(f"/ws/lists/{shared_list['id']}") as ws:
        ws.send_json({"type": "auth", "token": alice["_token"]})
        ws.receive_json()
        ws.send_text("to nie jest json")  # ignorowane, połączenie żyje dalej
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong"}


def test_bad_token_closes_4401(client, shared_list):
    with client.websocket_connect(f"/ws/lists/{shared_list['id']}") as ws:
        ws.send_json({"type": "auth", "token": "zły"})
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 4401


def test_first_message_must_be_auth(client, alice, shared_list):
    with client.websocket_connect(f"/ws/lists/{shared_list['id']}") as ws:
        ws.send_json({"type": "ping"})
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 4401


def test_non_member_closes_4404(client, shared_list):
    eve = make_guest(client, "Eve")
    with client.websocket_connect(f"/ws/lists/{shared_list['id']}") as ws:
        ws.send_json({"type": "auth", "token": eve["_token"]})
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 4404


def test_ready_lists_who_is_online(client, alice, bob, shared_list):
    url = f"/ws/lists/{shared_list['id']}"
    with client.websocket_connect(url) as ws_alice:
        assert names(auth(ws_alice, alice)) == ["Alice"]
        with client.websocket_connect(url) as ws_bob:
            assert names(auth(ws_bob, bob)) == ["Alice", "Bob"]


def test_presence_joined_and_left_are_broadcast(client, alice, bob, shared_list):
    url = f"/ws/lists/{shared_list['id']}"
    with client.websocket_connect(url) as ws_alice:
        auth(ws_alice, alice)

        with client.websocket_connect(url) as ws_bob:
            auth(ws_bob, bob)
            event = ws_alice.receive_json()
            assert event["type"] == "presence.joined"
            assert event["actor_id"] == bob["_id"]
            assert event["data"]["display_name"] == "Bob"

            disconnect(ws_bob)
            event = ws_alice.receive_json()
            assert event["type"] == "presence.left"
            assert event["data"]["id"] == bob["_id"]


def test_second_device_of_same_user_is_not_announced(client, alice, bob, shared_list):
    list_id = shared_list["id"]
    url = f"/ws/lists/{list_id}"
    with client.websocket_connect(url) as ws_alice:
        auth(ws_alice, alice)
        with client.websocket_connect(url) as ws_bob_phone:
            auth(ws_bob_phone, bob)
            assert ws_alice.receive_json()["type"] == "presence.joined"

            # Bob otwiera listę drugi raz (laptop) i zamyka: dla Alice nic się nie zmienia.
            with client.websocket_connect(url) as ws_bob_laptop:
                assert names(auth(ws_bob_laptop, bob)) == ["Alice", "Bob"]
                disconnect(ws_bob_laptop)

            # Następna wiadomość u Alice to zwykły event, a nie presence.joined/left.
            client.post(f"/lists/{list_id}/items", json={"name": "Chleb"}, headers=h(alice))
            assert ws_alice.receive_json()["type"] == "item.created"

            disconnect(ws_bob_phone)
            assert ws_alice.receive_json()["type"] == "presence.left"


def test_silent_connection_is_closed_4408(client, alice, shared_list, monkeypatch):
    monkeypatch.setattr(ws_router, "IDLE_TIMEOUT_S", 0.2)
    with client.websocket_connect(f"/ws/lists/{shared_list['id']}") as ws:
        auth(ws, alice)
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()  # klient milczy (brak pingów) → serwer zamyka
        assert exc.value.code == 4408
