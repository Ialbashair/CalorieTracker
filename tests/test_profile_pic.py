from io import BytesIO


def test_upload_profile_picture_success(client, auth_headers, monkeypatch, tmp_path):
    import main

    profile_upload_dir = tmp_path / "profile_pictures"
    profile_upload_dir.mkdir()

    monkeypatch.setattr(main, "USER_UPLOAD_DIR", str(profile_upload_dir))

    image_file = BytesIO(b"fake png image data")

    response = client.post(
        "/settings/profile-picture",
        files={
            "image": ("profile.png", image_file, "image/png")
        },
        headers=auth_headers
    )

    assert response.status_code == 200

    data = response.json()
    assert data["profile_picture"] is not None
    assert data["profile_picture"].startswith("/static/uploads/profile_pictures/")
    assert data["profile_picture"].endswith(".png")


def test_upload_profile_picture_rejects_invalid_file_type(client, auth_headers):
    text_file = BytesIO(b"not an image")

    response = client.post(
        "/settings/profile-picture",
        files={
            "image": ("notes.txt", text_file, "text/plain")
        },
        headers=auth_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only JPG, PNG, and WEBP images are allowed."