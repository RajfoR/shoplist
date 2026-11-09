from tests.conftest import h


def test_create_list_makes_owner_a_member(client, alice):
    res = client.post("/lists", json={"name": "Weekend"}, headers=h(alice))
    assert res.status_code == 201
    body = res.json()
    assert body["owner_id"] == alice["_id"]
    assert [m["id"] for m in body["members"]] == [alice["_id"]]
    assert body["items"] == []
    assert len(body["share_token"]) >= 16

    mine = client.get("/lists", headers=h(alice)).json()
    assert [lst["id"] for lst in mine] == [body["id"]]


def test_non_member_gets_404_not_403(client, alice, bob):
    lst = client.post("/lists", json={"name": "Prywatna"}, headers=h(alice)).json()
    assert client.get(f"/lists/{lst['id']}", headers=h(bob)).status_code == 404
    assert client.get("/lists", headers=h(bob)).json() == []


def test_join_by_share_token(client, alice, bob, shared_list):
    detail = client.get(f"/lists/{shared_list['id']}", headers=h(bob)).json()
    assert {m["display_name"] for m in detail["members"]} == {"Alice", "Bob"}


def test_join_is_idempotent(client, alice, bob, shared_list):
    token = shared_list["share_token"]
    client.post("/lists/join", json={"share_token": token}, headers=h(bob))
    detail = client.get(f"/lists/{shared_list['id']}", headers=h(bob)).json()
    assert len(detail["members"]) == 2


def test_join_with_bad_token_is_404(client, bob):
    res = client.post("/lists/join", json={"share_token": "nie-istnieje"}, headers=h(bob))
    assert res.status_code == 404


def test_only_owner_can_delete(client, alice, bob, shared_list):
    url = f"/lists/{shared_list['id']}"
    assert client.delete(url, headers=h(bob)).status_code == 403
    assert client.delete(url, headers=h(alice)).status_code == 204
    assert client.get(url, headers=h(alice)).status_code == 404


def test_rename(client, alice, bob, shared_list):
    res = client.patch(f"/lists/{shared_list['id']}", json={"name": "Lidl"}, headers=h(bob))
    assert res.status_code == 200
    assert res.json()["name"] == "Lidl"
