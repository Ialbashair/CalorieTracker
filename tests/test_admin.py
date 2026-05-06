import main

def test_admin_users_requires_admin(client, auth_headers):
    response = client.get("/admin/users", headers=auth_headers)

    assert response.status_code == 403


def test_admin_can_get_users(client, admin_headers):
    response = client.get("/admin/users", headers=admin_headers)

    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_admin_can_add_food(client, admin_headers):
    response = client.post(
        "/admin/foods",
        json={
            "name": "Protein Bar",
            "calories": 220,
            "serving_size_g": 60
        },
        headers=admin_headers
    )

    assert response.status_code == 201

    data = response.json()
    assert data["message"] == "Food added successfully"
    assert data["food"]["name"] == "protein bar"
    assert data["food"]["calories"] == 220
    assert data["food"]["serving_size_g"] == 60
    assert data["food"]["created_by_admin"] is True


def test_admin_add_food_rejects_duplicate(client, admin_headers):
    payload = {
        "name": "Protein Bar",
        "calories": 220,
        "serving_size_g": 60
    }

    client.post("/admin/foods", json=payload, headers=admin_headers)
    response = client.post("/admin/foods", json=payload, headers=admin_headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Food already exists"


def test_regular_user_cannot_add_admin_food(client, auth_headers):
    response = client.post(
        "/admin/foods",
        json={
            "name": "Admin Only Food",
            "calories": 100,
            "serving_size_g": 50
        },
        headers=auth_headers
    )

    assert response.status_code == 403


def test_admin_can_add_exercise(client, admin_headers):
    response = client.post(
        "/admin/exercises",
        json={
            "name": "Jump Rope",
            "calories_per_hour": 700
        },
        headers=admin_headers
    )

    assert response.status_code == 201

    data = response.json()
    assert data["message"] == "Exercise added successfully"
    assert data["exercise"]["name"] == "Jump Rope"
    assert data["exercise"]["calories_per_hour"] == 700
    assert data["exercise"]["created_by_admin"] is True


def test_admin_add_exercise_rejects_duplicate(client, admin_headers):
    payload = {
        "name": "Jump Rope",
        "calories_per_hour": 700
    }

    client.post("/admin/exercises", json=payload, headers=admin_headers)
    response = client.post("/admin/exercises", json=payload, headers=admin_headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Exercise already exists"


def test_admin_can_change_user_role(client, admin_headers):
    result = main.users_collection.insert_one({
        "username": "regularuser",
        "email": "regular@example.com",
        "password": main.hash_password("password123"),
        "role": "user",
        "created_at": main.datetime.now(main.timezone.utc)
    })

    user_id = str(result.inserted_id)

    response = client.put(
        f"/admin/users/{user_id}/role",
        json={
            "role": "admin"
        },
        headers=admin_headers
    )

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == user_id
    assert data["role"] == "admin"


def test_admin_role_update_rejects_invalid_role(client, admin_headers):
    result = main.users_collection.insert_one({
        "username": "regularuser",
        "email": "regular@example.com",
        "password": main.hash_password("password123"),
        "role": "user",
        "created_at": main.datetime.now(main.timezone.utc)
    })

    user_id = str(result.inserted_id)

    response = client.put(
        f"/admin/users/{user_id}/role",
        json={
            "role": "owner"
        },
        headers=admin_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Role must be 'user' or 'admin'"


def test_admin_can_delete_user(client, admin_headers):
    result = main.users_collection.insert_one({
        "username": "deleteuser",
        "email": "delete@example.com",
        "password": main.hash_password("password123"),
        "role": "user",
        "created_at": main.datetime.now(main.timezone.utc)
    })

    user_id = str(result.inserted_id)

    response = client.delete(f"/admin/users/{user_id}", headers=admin_headers)

    assert response.status_code == 204
    assert main.users_collection.find_one({"_id": result.inserted_id}) is None

from bson import ObjectId
import main


def test_admin_delete_user_rejects_invalid_user_id(client, admin_headers):
    response = client.delete("/admin/users/not-valid", headers=admin_headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid user ID"


def test_admin_delete_user_rejects_missing_user(client, admin_headers):
    fake_id = str(ObjectId())

    response = client.delete(f"/admin/users/{fake_id}", headers=admin_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


def test_admin_cannot_delete_self(client, admin_headers):
    admin_user = main.users_collection.find_one({"email": "admin@example.com"})
    admin_id = str(admin_user["_id"])

    response = client.delete(f"/admin/users/{admin_id}", headers=admin_headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Admins cannot delete themselves"


def test_admin_update_role_rejects_invalid_user_id(client, admin_headers):
    response = client.put(
        "/admin/users/not-valid/role",
        json={"role": "admin"},
        headers=admin_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid user ID"


def test_admin_update_role_rejects_missing_user(client, admin_headers):
    fake_id = str(ObjectId())

    response = client.put(
        f"/admin/users/{fake_id}/role",
        json={"role": "admin"},
        headers=admin_headers
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


def test_admin_cannot_change_own_role(client, admin_headers):
    admin_user = main.users_collection.find_one({"email": "admin@example.com"})
    admin_id = str(admin_user["_id"])

    response = client.put(
        f"/admin/users/{admin_id}/role",
        json={"role": "user"},
        headers=admin_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Admins cannot change their own role"


def test_admin_add_food_rejects_empty_name(client, admin_headers):
    response = client.post(
        "/admin/foods",
        json={
            "name": "   ",
            "calories": 100,
            "serving_size_g": 50
        },
        headers=admin_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Food name cannot be empty"


def test_admin_add_food_rejects_negative_calories(client, admin_headers):
    response = client.post(
        "/admin/foods",
        json={
            "name": "Test Food",
            "calories": -10,
            "serving_size_g": 50
        },
        headers=admin_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Calories must be greater than 0"


def test_admin_add_food_rejects_bad_serving_size(client, admin_headers):
    response = client.post(
        "/admin/foods",
        json={
            "name": "Test Food",
            "calories": 100,
            "serving_size_g": 0
        },
        headers=admin_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Serving size must be greater than 0"


def test_admin_add_exercise_rejects_empty_name(client, admin_headers):
    response = client.post(
        "/admin/exercises",
        json={
            "name": "   ",
            "calories_per_hour": 500
        },
        headers=admin_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Exercise name cannot be empty"


def test_admin_add_exercise_rejects_negative_calories(client, admin_headers):
    response = client.post(
        "/admin/exercises",
        json={
            "name": "Jump Rope",
            "calories_per_hour": -1
        },
        headers=admin_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Calories per hour must be greater than 0"