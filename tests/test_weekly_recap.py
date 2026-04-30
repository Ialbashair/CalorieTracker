def test_weekly_recap_returns_expected_shape(client, auth_headers):
    client.post(
        "/food-logs",
        json={
            "food_name": "Rice",
            "calories": 200,
            "grams": 150,
            "log_date": "2026-04-30"
        },
        headers=auth_headers
    )

    client.post(
        "/exercise-logs",
        json={
            "exercise_name": "Running",
            "calories_burned": 100,
            "hours": 0.5,
            "log_date": "2026-04-30"
        },
        headers=auth_headers
    )

    response = client.get("/weekly-recap", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()
    assert "week_start" in data
    assert "week_end" in data
    assert "total_consumed" in data
    assert "total_burned" in data
    assert "net_calories" in data
    assert "days_logged" in data
    assert "daily" in data
    assert len(data["daily"]) == 7