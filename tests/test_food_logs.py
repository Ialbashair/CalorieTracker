def test_add_food_log_success(client, auth_headers):
    response = client.post(
        "/food-logs",
        json={
            "food_name": "Banana",
            "calories": 105,
            "grams": 118,
            "log_date": "2026-04-30"
        },
        headers=auth_headers
    )

    assert response.status_code == 201

    data = response.json()
    assert data["food_name"] == "Banana"
    assert data["calories"] == 105
    assert data["grams"] == 118


def test_get_food_logs_by_date(client, auth_headers):
    client.post(
        "/food-logs",
        json={
            "food_name": "Banana",
            "calories": 105,
            "grams": 118,
            "log_date": "2026-04-30"
        },
        headers=auth_headers
    )

    client.post(
        "/food-logs",
        json={
            "food_name": "Apple",
            "calories": 95,
            "grams": 150,
            "log_date": "2026-05-01"
        },
        headers=auth_headers
    )

    response = client.get("/food-logs?date=2026-04-30", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["food_name"] == "Banana"


def test_food_logs_require_authentication(client):
    response = client.get("/food-logs")

    assert response.status_code == 401