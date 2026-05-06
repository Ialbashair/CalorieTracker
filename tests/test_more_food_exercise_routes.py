from bson import ObjectId
import main


def test_get_foods_returns_seeded_foods(client, auth_headers):
    main.foods_collection.insert_one({
        "name": "banana",
        "calories": 105,
        "serving_size_g": 118,
        "serving_unit": "g",
        "category": "fruit"
    })

    response = client.get("/foods", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "banana"
    assert data[0]["calories"] == 105
    assert data[0]["serving_size"] == 118
    assert data[0]["serving_unit"] == "g"
    assert data[0]["category"] == "fruit"


def test_get_exercises_returns_seeded_exercises(client, auth_headers):
    main.exercises_collection.insert_one({
        "name": "Running",
        "calories_per_hour": 600
    })

    response = client.get("/exercises", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Running"
    assert data[0]["calories_per_hour"] == 600


def test_add_food_log_rejects_invalid_meal(client, auth_headers):
    response = client.post(
        "/food-logs",
        json={
            "food_name": "Banana",
            "calories": 105,
            "amount": 118,
            "unit": "g",
            "meal": "midnight meal"
        },
        headers=auth_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Meal must be breakfast, lunch, dinner, or snack"


def test_add_food_log_rejects_invalid_unit(client, auth_headers):
    response = client.post(
        "/food-logs",
        json={
            "food_name": "Banana",
            "calories": 105,
            "amount": 118,
            "unit": "ounces",
            "meal": "breakfast"
        },
        headers=auth_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unit must be 'g' or 'mL'"


def test_update_food_log_success(client, auth_headers):
    create_response = client.post(
        "/food-logs",
        json={
            "food_name": "Banana",
            "calories": 105,
            "amount": 118,
            "unit": "g",
            "meal": "breakfast"
        },
        headers=auth_headers
    )

    log_id = create_response.json()["id"]

    response = client.put(
        f"/food-logs/{log_id}",
        json={
            "food_name": "Apple",
            "calories": 95,
            "amount": 150,
            "unit": "g",
            "meal": "snack"
        },
        headers=auth_headers
    )

    assert response.status_code == 200

    data = response.json()
    assert data["food_name"] == "Apple"
    assert data["calories"] == 95
    assert data["amount"] == 150
    assert data["meal"] == "snack"


def test_update_food_log_invalid_id(client, auth_headers):
    response = client.put(
        "/food-logs/not-a-real-id",
        json={
            "food_name": "Apple",
            "calories": 95,
            "amount": 150,
            "unit": "g",
            "meal": "snack"
        },
        headers=auth_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid food log ID"


def test_delete_food_log_success(client, auth_headers):
    create_response = client.post(
        "/food-logs",
        json={
            "food_name": "Banana",
            "calories": 105,
            "amount": 118,
            "unit": "g",
            "meal": "breakfast"
        },
        headers=auth_headers
    )

    log_id = create_response.json()["id"]

    response = client.delete(f"/food-logs/{log_id}", headers=auth_headers)

    assert response.status_code == 204

    get_response = client.get("/food-logs", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json() == []


def test_delete_food_log_not_found(client, auth_headers):
    fake_id = str(ObjectId())

    response = client.delete(f"/food-logs/{fake_id}", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Food log not found"


def test_update_exercise_log_success(client, auth_headers):
    create_response = client.post(
        "/exercise-logs",
        json={
            "exercise_name": "Running",
            "calories_burned": 300,
            "hours": 1
        },
        headers=auth_headers
    )

    log_id = create_response.json()["id"]

    response = client.put(
        f"/exercise-logs/{log_id}",
        json={
            "exercise_name": "Walking",
            "calories_burned": 150,
            "hours": 0.75
        },
        headers=auth_headers
    )

    assert response.status_code == 200

    data = response.json()
    assert data["exercise_name"] == "Walking"
    assert data["calories_burned"] == 150
    assert data["hours"] == 0.75


def test_delete_exercise_log_success(client, auth_headers):
    create_response = client.post(
        "/exercise-logs",
        json={
            "exercise_name": "Running",
            "calories_burned": 300,
            "hours": 1
        },
        headers=auth_headers
    )

    log_id = create_response.json()["id"]

    response = client.delete(f"/exercise-logs/{log_id}", headers=auth_headers)

    assert response.status_code == 204

    get_response = client.get("/exercise-logs", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json() == []


def test_delete_exercise_log_invalid_id(client, auth_headers):
    response = client.delete("/exercise-logs/bad-id", headers=auth_headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid exercise log ID"