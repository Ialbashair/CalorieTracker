def test_register_user_success(client):
    response = client.post("/register", json={
        "username": "jacob",
        "email": "jacob@example.com",
        "password": "password123"
    })

    assert response.status_code == 201

    data = response.json()
    assert data["username"] == "jacob"
    assert data["email"] == "jacob@example.com"
    assert data["role"] == "user"
    assert "id" in data
    assert "password" not in data


def test_register_duplicate_email_fails(client):
    client.post("/register", json={
        "username": "jacob",
        "email": "jacob@example.com",
        "password": "password123"
    })

    response = client.post("/register", json={
        "username": "jacob2",
        "email": "jacob@example.com",
        "password": "password123"
    })

    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"


def test_login_success(client):
    client.post("/register", json={
        "username": "jacob",
        "email": "jacob@example.com",
        "password": "password123"
    })

    response = client.post("/login", json={
        "email": "jacob@example.com",
        "password": "password123"
    })

    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "jacob@example.com"


def test_login_wrong_password_fails(client):
    client.post("/register", json={
        "username": "jacob",
        "email": "jacob@example.com",
        "password": "password123"
    })

    response = client.post("/login", json={
        "email": "jacob@example.com",
        "password": "wrongpassword"
    })

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_me_requires_authentication(client):
    response = client.get("/me")

    assert response.status_code == 401