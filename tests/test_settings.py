def test_get_default_user_goals(client, auth_headers):
    response = client.get("/settings/goals", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()
    assert data["calorie_goal"] == 2000
    assert data["exercise_goal"] == 500
    assert data["water_goal_ml"] == 2000


def test_update_user_goals_success(client, auth_headers):
    response = client.put(
        "/settings/goals",
        json={
            "calorie_goal": 2200,
            "exercise_goal": 600,
            "water_goal_ml": 2500
        },
        headers=auth_headers
    )

    assert response.status_code == 200

    data = response.json()
    assert data["calorie_goal"] == 2200
    assert data["exercise_goal"] == 600
    assert data["water_goal_ml"] == 2500


def test_update_user_goals_rejects_negative_values(client, auth_headers):
    response = client.put(
        "/settings/goals",
        json={
            "calorie_goal": -1,
            "exercise_goal": 600,
            "water_goal_ml": 2500
        },
        headers=auth_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Calorie goal must be greater than 0"


def test_update_username_success(client, auth_headers):
    response = client.put(
        "/settings/username",
        json={
            "new_username": "newtestuser"
        },
        headers=auth_headers
    )

    assert response.status_code == 200

    data = response.json()
    assert data["username"] == "newtestuser"


def test_update_username_rejects_empty_username(client, auth_headers):
    response = client.put(
        "/settings/username",
        json={
            "new_username": "   "
        },
        headers=auth_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Username cannot be empty"


def test_update_password_success(client, auth_headers):
    response = client.put(
        "/settings/password",
        json={
            "current_password": "password123",
            "new_password": "newpassword123"
        },
        headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Password updated successfully"


def test_update_password_rejects_wrong_current_password(client, auth_headers):
    response = client.put(
        "/settings/password",
        json={
            "current_password": "wrongpassword",
            "new_password": "newpassword123"
        },
        headers=auth_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"