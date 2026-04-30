def test_admin_users_requires_admin(client, auth_headers):
    response = client.get("/admin/users", headers=auth_headers)

    assert response.status_code == 403


def test_admin_can_get_users(client, admin_headers):
    response = client.get("/admin/users", headers=admin_headers)

    assert response.status_code == 200
    assert isinstance(response.json(), list)