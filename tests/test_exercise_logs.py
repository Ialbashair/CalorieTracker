def test_add_exercise_log_success(client, auth_headers):
    response = client.post(
        "/exercise-logs",
        json={
            "exercise_name": "Running",
            "calories_burned": 300,
            "hours": 1,
            "log_date": "2026-04-30"
        },
        headers=auth_headers
    )

    assert response.status_code == 201

    data = response.json()
    assert data["exercise_name"] == "Running"
    assert data["calories_burned"] == 300
    assert data["hours"] == 1


def test_get_exercise_logs_by_date(client, auth_headers):
    client.post(
        "/exercise-logs",
        json={
            "exercise_name": "Running",
            "calories_burned": 300,
            "hours": 1,
            "log_date": "2026-04-30"
        },
        headers=auth_headers
    )

    client.post(
        "/exercise-logs",
        json={
            "exercise_name": "Walking",
            "calories_burned": 120,
            "hours": 0.5,
            "log_date": "2026-05-01"
        },
        headers=auth_headers
    )

    response = client.get("/exercise-logs?date=2026-04-30", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["exercise_name"] == "Running"


def test_exercise_logs_require_authentication(client):
    response = client.get("/exercise-logs")

    assert response.status_code == 401