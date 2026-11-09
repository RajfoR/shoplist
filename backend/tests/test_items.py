from tests.conftest import h


def test_item_lifecycle_and_versioning(client, alice, bob, shared_list):
    list_id = shared_list["id"]
    res = client.post(
        f"/lists/{list_id}/items", json={"name": "Mleko", "quantity": "2 l"}, headers=h(alice)
    )
    assert res.status_code == 201
    item = res.json()
    assert item["version"] == 1
    assert item["checked"] is False
    assert item["created_by"] == alice["_id"]

    res = client.patch(f"/items/{item['id']}", json={"checked": True}, headers=h(bob))
    assert res.status_code == 200
    updated = res.json()
    assert updated["checked"] is True
    assert updated["version"] == 2
    assert updated["quantity"] == "2 l"  # pole pominięte = bez zmian

    res = client.patch(f"/items/{item['id']}", json={"quantity": None}, headers=h(alice))
    assert res.json()["quantity"] is None
    assert res.json()["version"] == 3

    assert client.delete(f"/items/{item['id']}", headers=h(bob)).status_code == 204
    detail = client.get(f"/lists/{list_id}", headers=h(alice)).json()
    assert detail["items"] == []


def test_outsider_cannot_touch_items(client, alice, shared_list):
    from tests.conftest import make_guest

    eve = make_guest(client, "Eve")
    list_id = shared_list["id"]
    item = client.post(f"/lists/{list_id}/items", json={"name": "Chleb"}, headers=h(alice)).json()

    assert (
        client.post(f"/lists/{list_id}/items", json={"name": "x"}, headers=h(eve)).status_code
        == 404
    )
    assert (
        client.patch(f"/items/{item['id']}", json={"checked": True}, headers=h(eve)).status_code
        == 404
    )
    assert client.delete(f"/items/{item['id']}", headers=h(eve)).status_code == 404


def test_items_keep_insertion_order(client, alice, shared_list):
    list_id = shared_list["id"]
    for name in ["Jajka", "Masło", "Ser"]:
        client.post(f"/lists/{list_id}/items", json={"name": name}, headers=h(alice))
    detail = client.get(f"/lists/{list_id}", headers=h(alice)).json()
    assert [i["name"] for i in detail["items"]] == ["Jajka", "Masło", "Ser"]


def test_client_generated_id(client, alice, bob, shared_list):
    import uuid

    list_id = shared_list["id"]
    item_id = str(uuid.uuid4())
    res = client.post(
        f"/lists/{list_id}/items", json={"id": item_id, "name": "Kawa"}, headers=h(alice)
    )
    assert res.status_code == 201
    assert res.json()["id"] == item_id

    # Ponowienie z tym samym id (np. retry po zerwanym połączeniu) → 409, bez duplikatu.
    res = client.post(
        f"/lists/{list_id}/items", json={"id": item_id, "name": "Kawa"}, headers=h(bob)
    )
    assert res.status_code == 409
    detail = client.get(f"/lists/{list_id}", headers=h(alice)).json()
    assert [i["id"] for i in detail["items"]] == [item_id]
