import pytest
from starlette.websockets import WebSocketDisconnect

from tests.conftest import h, make_guest


def test_member_receives_events_from_other_member(client, alice, bob, shared_list):
    list_id = shared_list["id"]
    with client.websocket_connect(f"/ws/lists/{list_id}") as ws:
        ws.send_json({"type": "auth", "token": bob["_token"]})
        ready = ws.receive_json()
        assert ready == {"type": "ready", "list_id": list_id, "user_id": bob["_id"]}

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
