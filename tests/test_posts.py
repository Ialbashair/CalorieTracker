from io import BytesIO


def create_test_post(client, auth_headers, caption="Test post"):
    image_bytes = BytesIO(b"fake image data")

    response = client.post(
        "/posts",
        data={
            "caption": caption
        },
        files={
            "images": ("test.png", image_bytes, "image/png")
        },
        headers=auth_headers
    )

    return response


def test_create_post_success(client, auth_headers):
    response = create_test_post(client, auth_headers, caption="My first post")

    assert response.status_code == 201

    data = response.json()
    assert data["caption"] == "My first post"
    assert data["likes"] == 0
    assert data["liked_by"] == []
    assert len(data["images"]) == 1


def test_create_post_rejects_invalid_image_type(client, auth_headers):
    file_bytes = BytesIO(b"not really an image")

    response = client.post(
        "/posts",
        data={
            "caption": "Invalid image"
        },
        files={
            "images": ("test.txt", file_bytes, "text/plain")
        },
        headers=auth_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only JPG, PNG, and WEBP images are allowed."


def test_get_recent_posts_success(client, auth_headers):
    create_test_post(client, auth_headers, caption="Post one")

    response = client.get("/posts", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["caption"] == "Post one"


def test_update_own_post_success(client, auth_headers):
    create_response = create_test_post(client, auth_headers, caption="Old caption")
    post_id = create_response.json()["id"]

    response = client.put(
        f"/posts/{post_id}",
        json={
            "caption": "Updated caption"
        },
        headers=auth_headers
    )

    assert response.status_code == 200

    data = response.json()
    assert data["caption"] == "Updated caption"


def test_like_and_unlike_post_success(client, auth_headers):
    create_response = create_test_post(client, auth_headers, caption="Like me")
    post_id = create_response.json()["id"]

    like_response = client.post(f"/posts/{post_id}/like", headers=auth_headers)

    assert like_response.status_code == 200
    assert like_response.json()["liked"] is True
    assert like_response.json()["likes"] == 1

    unlike_response = client.post(f"/posts/{post_id}/like", headers=auth_headers)

    assert unlike_response.status_code == 200
    assert unlike_response.json()["liked"] is False
    assert unlike_response.json()["likes"] == 0


def test_my_posts_and_profile_stats(client, auth_headers):
    create_test_post(client, auth_headers, caption="Profile post")

    posts_response = client.get("/my-posts", headers=auth_headers)
    stats_response = client.get("/my-profile-stats", headers=auth_headers)

    assert posts_response.status_code == 200
    assert stats_response.status_code == 200

    posts = posts_response.json()
    stats = stats_response.json()

    assert len(posts) == 1
    assert posts[0]["caption"] == "Profile post"
    assert stats["post_count"] == 1
    assert stats["total_likes"] == 0


def test_delete_own_post_success(client, auth_headers):
    create_response = create_test_post(client, auth_headers, caption="Delete me")
    post_id = create_response.json()["id"]

    delete_response = client.delete(f"/posts/{post_id}", headers=auth_headers)

    assert delete_response.status_code == 204

    posts_response = client.get("/posts", headers=auth_headers)
    assert posts_response.status_code == 200
    assert posts_response.json() == []

from io import BytesIO


def create_user_and_headers(client, username, email, password="password123"):
    client.post(
        "/register",
        json={
            "username": username,
            "email": email,
            "password": password
        }
    )

    login_response = client.post(
        "/login",
        json={
            "email": email,
            "password": password
        }
    )

    token = login_response.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}"
    }


def create_post_for_user(client, headers, caption="Test caption"):
    image_file = BytesIO(b"fake image data")

    response = client.post(
        "/posts",
        data={
            "caption": caption
        },
        files={
            "images": ("test.png", image_file, "image/png")
        },
        headers=headers
    )

    return response


def test_user_cannot_update_another_users_post(client, monkeypatch, tmp_path):
    import main

    upload_dir = tmp_path / "posts"
    upload_dir.mkdir()
    monkeypatch.setattr(main, "UPLOAD_DIR", str(upload_dir))

    owner_headers = create_user_and_headers(client, "owner", "owner@example.com")
    other_headers = create_user_and_headers(client, "other", "other@example.com")

    create_response = create_post_for_user(client, owner_headers, "Owner post")
    post_id = create_response.json()["id"]

    response = client.put(
        f"/posts/{post_id}",
        json={
            "caption": "Trying to steal this post"
        },
        headers=other_headers
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "You can only edit your own posts"


def test_user_cannot_delete_another_users_post(client, monkeypatch, tmp_path):
    import main

    upload_dir = tmp_path / "posts"
    upload_dir.mkdir()
    monkeypatch.setattr(main, "UPLOAD_DIR", str(upload_dir))

    owner_headers = create_user_and_headers(client, "owner", "owner@example.com")
    other_headers = create_user_and_headers(client, "other", "other@example.com")

    create_response = create_post_for_user(client, owner_headers, "Owner post")
    post_id = create_response.json()["id"]

    response = client.delete(f"/posts/{post_id}", headers=other_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "You can only delete your own posts"


def test_update_post_invalid_id(client, auth_headers):
    response = client.put(
        "/posts/not-valid",
        json={
            "caption": "Updated caption"
        },
        headers=auth_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid post ID"


def test_delete_post_invalid_id(client, auth_headers):
    response = client.delete("/posts/not-valid", headers=auth_headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid post ID"


def test_like_post_invalid_id(client, auth_headers):
    response = client.post("/posts/not-valid/like", headers=auth_headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid post ID"