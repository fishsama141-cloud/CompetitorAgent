"""Auth module tests — register, login, me, protected routes.

Run: pytest backend/tests/test_auth.py -v
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.schemas import TokenResponse, UserMeResponse

API = "/api/v1"


@pytest.fixture
def auth_client(client: TestClient) -> TestClient:
    """Ensure fresh state by deleting test user if exists, then register."""
    # We can't easily delete from SQLite in test without DB access,
    # so we use unique usernames per test.
    return client


class TestAuthRegister:
    """POST /auth/register"""

    def test_01_register_returns_token(self, auth_client: TestClient):
        resp = auth_client.post(
            f"{API}/auth/register",
            json={"username": "testuser_a", "password": "secret123"},
        )
        assert resp.status_code == 200
        parsed = TokenResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert parsed.data is not None
        assert parsed.data.access_token
        assert parsed.data.token_type == "bearer"
        assert parsed.data.username == "testuser_a"

    def test_02_register_duplicate_returns_409(self, auth_client: TestClient):
        # Register once
        auth_client.post(
            f"{API}/auth/register",
            json={"username": "testuser_dup", "password": "secret123"},
        )
        # Register again
        resp = auth_client.post(
            f"{API}/auth/register",
            json={"username": "testuser_dup", "password": "secret456"},
        )
        assert resp.status_code == 409
        data = resp.json()
        assert "用户名已被注册" in data.get("detail", "")


class TestAuthLogin:
    """POST /auth/login"""

    def test_03_login_valid_returns_token(self, auth_client: TestClient):
        # Register first
        auth_client.post(
            f"{API}/auth/register",
            json={"username": "testuser_login", "password": "mypassword"},
        )
        # Login
        resp = auth_client.post(
            f"{API}/auth/login",
            json={"username": "testuser_login", "password": "mypassword"},
        )
        assert resp.status_code == 200
        parsed = TokenResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert parsed.data is not None
        assert parsed.data.access_token

    def test_04_login_wrong_password_returns_401(self, auth_client: TestClient):
        # Register first
        auth_client.post(
            f"{API}/auth/register",
            json={"username": "testuser_wrong", "password": "correct"},
        )
        # Login with wrong password
        resp = auth_client.post(
            f"{API}/auth/login",
            json={"username": "testuser_wrong", "password": "wrongpass"},
        )
        assert resp.status_code == 401
        data = resp.json()
        assert "用户名或密码错误" in data.get("detail", "")


class TestAuthMe:
    """GET /auth/me"""

    def test_05_me_with_valid_token(self, auth_client: TestClient):
        # Register
        reg = auth_client.post(
            f"{API}/auth/register",
            json={"username": "testuser_me", "password": "secret123"},
        )
        token = reg.json()["data"]["access_token"]

        # Get me
        resp = auth_client.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        parsed = UserMeResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert parsed.data is not None
        assert parsed.data.username == "testuser_me"
        assert parsed.data.id > 0

    def test_06_me_without_token_returns_401(self, auth_client: TestClient):
        resp = auth_client.get(f"{API}/auth/me")
        assert resp.status_code == 401
