def test_add_water_log_success(client, auth_headers):
    response = client.post(
        "/water-logs",
        json={
            "amount_ml": 500,
            "log_date": "2026-04-30"
        },
        headers=auth_headers
    )

    assert response.status_code == 201

    data = response.json()
    assert data["amount_ml"] == 500
    assert "id" in data


def test_add_water_log_rejects_zero_amount(client, auth_headers):
    response = client.post(
        "/water-logs",
        json={
            "amount_ml": 0,
            "log_date": "2026-04-30"
        },
        headers=auth_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Amount must be greater than 0"


def test_get_water_logs_success(client, auth_headers):
    client.post(
        "/water-logs",
        json={
            "amount_ml": 750,
            "log_date": "2026-04-30"
        },
        headers=auth_headers
    )

    response = client.get("/water-logs", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["amount_ml"] == 750


def test_update_water_log_success(client, auth_headers):
    create_response = client.post(
        "/water-logs",
        json={
            "amount_ml": 500,
            "log_date": "2026-04-30"
        },
        headers=auth_headers
    )

    log_id = create_response.json()["id"]

    response = client.put(
        f"/water-logs/{log_id}",
        json={
            "amount_ml": 900
        },
        headers=auth_headers
    )

    assert response.status_code == 200

    data = response.json()
    assert data["amount_ml"] == 900


def test_delete_water_log_success(client, auth_headers):
    create_response = client.post(
        "/water-logs",
        json={
            "amount_ml": 500,
            "log_date": "2026-04-30"
        },
        headers=auth_headers
    )

    log_id = create_response.json()["id"]

    delete_response = client.delete(f"/water-logs/{log_id}", headers=auth_headers)

    assert delete_response.status_code == 204

    get_response = client.get("/water-logs", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json() == []


def test_water_logs_require_authentication(client):
    response = client.get("/water-logs")

    assert response.status_code == 401