"""
OIDC Auth endpoints — Backend-Proxy pattern.

The frontend NEVER talks to Keycloak directly.
All token exchange happens here on the server.
Tokens are stored in a server-side HttpOnly session cookie.

Endpoints:
  GET  /auth/login     → redirect to Keycloak login page
  GET  /auth/callback  → exchange code, store token, redirect to frontend
  GET  /auth/logout    → clear session + redirect to Keycloak logout
  GET  /auth/me        → return current user info (from session token)
"""

import httpx
import secrets
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from app.core.config import settings
from app.core.security import verify_oidc_token, extract_user_info
from app.api.deps import CurrentUser, DbSession

router = APIRouter(prefix="/auth", tags=["auth"])

# Frontend redirect after successful login/logout
FRONTEND_HOME = "http://localhost:5173"
FRONTEND_DASHBOARD = "http://localhost:5173/workspace"

# Backend callback URL (must be registered in Keycloak client config)
CALLBACK_URL = "http://localhost:8000/api/auth/callback"


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    firstName: str | None = None
    lastName: str | None = None


@router.post("/register")
async def register(request: Request, body: RegisterRequest):
    """
    Register a new user in the realm and automatically log them in.
    """
    async with httpx.AsyncClient() as client:
        # 1. Fetch Keycloak admin token from master realm
        token_resp = await client.post(
            f"{settings.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token",
            data={
                "grant_type": "password",
                "client_id": "admin-cli",
                "username": settings.KEYCLOAK_ADMIN,
                "password": settings.KEYCLOAK_ADMIN_PASSWORD,
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to obtain admin token from Keycloak: {token_resp.text}",
            )
        admin_token = token_resp.json().get("access_token")

        # 2. Call Keycloak Admin REST API to create user
        first_name = (body.firstName or "").strip() or body.username
        last_name = (body.lastName or "").strip() or body.username

        email_val = (body.email or "").strip()
        if not email_val:
            email_val = f"{body.username}@daggle.local"
        elif "@" not in email_val:
            email_val = f"{email_val}@daggle.local"

        headers = {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json",
        }
        create_resp = await client.post(
            f"{settings.KEYCLOAK_URL}/admin/realms/{settings.KEYCLOAK_REALM}/users",
            headers=headers,
            json={
                "username": body.username,
                "enabled": True,
                "email": email_val,
                "firstName": first_name,
                "lastName": last_name,
                "emailVerified": True,
                "requiredActions": [],
                "credentials": [
                    {
                        "type": "password",
                        "value": body.password,
                        "temporary": False,
                    }
                ],
            },
        )

        if create_resp.status_code == 409:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already exists.",
            )
        elif create_resp.status_code >= 300:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create user in Keycloak: {create_resp.text}",
            )

        # Clear requiredActions (like UPDATE_PASSWORD or VERIFY_EMAIL) that Keycloak automatically adds
        location = create_resp.headers.get("Location")
        if location:
            user_id = location.split("/")[-1]
            update_resp = await client.put(
                f"{settings.KEYCLOAK_URL}/admin/realms/{settings.KEYCLOAK_REALM}/users/{user_id}",
                headers=headers,
                json={
                    "emailVerified": True,
                    "requiredActions": []
                }
            )
            if update_resp.status_code >= 300:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to update user required actions: {update_resp.text}",
                )

        # 3. Automatically authenticate and log in the user
        login_resp = await client.post(
            settings.keycloak_token_url,
            data={
                "grant_type": "password",
                "client_id": settings.KEYCLOAK_CLIENT_ID,
                "client_secret": settings.KEYCLOAK_CLIENT_SECRET,
                "username": body.username,
                "password": body.password,
                "scope": "openid profile email",
            },
        )

        if login_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"User registered, but automatic sign-in failed: {login_resp.text}",
            )

        tokens = login_resp.json()
        request.session["access_token"] = tokens.get("access_token")
        if "id_token" in tokens:
            request.session["id_token"] = tokens["id_token"]

    return {"success": True}


@router.post("/login")
async def login_direct(request: Request, body: LoginRequest):
    """
    Direct credentials authentication (Password Grant flow).
    Authenticates username and password against Keycloak and sets session cookie.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            settings.keycloak_token_url,
            data={
                "grant_type": "password",
                "client_id": settings.KEYCLOAK_CLIENT_ID,
                "client_secret": settings.KEYCLOAK_CLIENT_SECRET,
                "username": body.username,
                "password": body.password,
                "scope": "openid profile email",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    tokens = resp.json()
    request.session["access_token"] = tokens.get("access_token")
    if "id_token" in tokens:
        request.session["id_token"] = tokens["id_token"]

    return {"success": True}


@router.get("/login")
async def login(request: Request):
    """
    Redirect the user to Keycloak's login page.

    Generates a PKCE-style state param to prevent CSRF.
    """
    state = secrets.token_urlsafe(32)
    request.session["oauth_state"] = state

    params = {
        "client_id": settings.KEYCLOAK_CLIENT_ID,
        "redirect_uri": CALLBACK_URL,
        "response_type": "code",
        "scope": "openid profile email",
        "state": state,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{settings.keycloak_auth_url}?{query}")


@router.get("/callback")
async def callback(request: Request, code: str, state: str):
    """
    Keycloak redirects here after successful login.
    Exchange auth code for tokens, store in session, redirect to frontend.
    """
    # CSRF state check
    stored_state = request.session.pop("oauth_state", None)
    if stored_state != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            settings.keycloak_token_url,
            data={
                "grant_type": "authorization_code",
                "client_id": settings.KEYCLOAK_CLIENT_ID,
                "client_secret": settings.KEYCLOAK_CLIENT_SECRET,
                "redirect_uri": CALLBACK_URL,
                "code": code,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token exchange failed: {resp.text}",
        )

    tokens = resp.json()

    # Store access_token and id_token in session.
    # id_token is required to cleanly log out of Keycloak via OIDC RP-initiated logout.
    request.session["access_token"] = tokens.get("access_token")
    if "id_token" in tokens:
        request.session["id_token"] = tokens["id_token"]

    return RedirectResponse(url=FRONTEND_DASHBOARD)


@router.get("/logout")
async def logout(request: Request):
    """
    Clear the server session and redirect to Keycloak's logout endpoint
    so the SSO session is also terminated (important for Kubeflow federation).
    """
    id_token = request.session.get("id_token")
    request.session.clear()

    # Keycloak RP-initiated logout (OIDC Core spec)
    params = f"post_logout_redirect_uri={FRONTEND_HOME}"
    if id_token:
        params += f"&id_token_hint={id_token}"

    return RedirectResponse(url=f"{settings.keycloak_logout_url}?{params}")


class UpdateProfileRequest(BaseModel):
    firstName: str | None = None
    lastName: str | None = None
    email: str | None = None


@router.get("/me")
async def me(user: CurrentUser):
    """
    Return current authenticated user info (from validated session token).
    Frontend calls this on app load to hydrate AuthContext.
    """
    return user


@router.put("/me")
async def update_profile(
    body: UpdateProfileRequest,
    user: CurrentUser,
    db: DbSession,
):
    """
    Update the current authenticated user's profile details.
    """
    async with httpx.AsyncClient() as client:
        # 1. Fetch Keycloak admin token from master realm
        token_resp = await client.post(
            f"{settings.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token",
            data={
                "grant_type": "password",
                "client_id": "admin-cli",
                "username": settings.KEYCLOAK_ADMIN,
                "password": settings.KEYCLOAK_ADMIN_PASSWORD,
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to obtain admin token: {token_resp.text}",
            )
        admin_token = token_resp.json().get("access_token")

        # 2. Call Keycloak Admin REST API to update user details
        headers = {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json",
        }
        payload = {}
        if body.firstName is not None:
            payload["firstName"] = body.firstName
        if body.lastName is not None:
            payload["lastName"] = body.lastName
        if body.email is not None:
            email_val = body.email.strip()
            if email_val:
                if "@" not in email_val:
                    email_val = f"{email_val}@daggle.local"
                payload["email"] = email_val

        if payload:
            update_resp = await client.put(
                f"{settings.KEYCLOAK_URL}/admin/realms/{settings.KEYCLOAK_REALM}/users/{user['sub']}",
                headers=headers,
                json=payload,
            )
            if update_resp.status_code >= 300:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to update user in Keycloak: {update_resp.text}",
                )

    # 3. Update local database shadow record
    from app.models import User
    local = db.query(User).filter(User.keycloak_id == user["sub"]).first()
    if local:
        if body.firstName is not None or body.lastName is not None:
            # Reconstruct display name using fallback logic
            first = body.firstName.strip() if body.firstName is not None else user.get("name", "").split(" ")[0]
            last = body.lastName.strip() if body.lastName is not None else (user.get("name", "").split(" ")[1] if len(user.get("name", "").split(" ")) > 1 else "")
            local.display_name = f"{first} {last}".strip()
        if body.email is not None:
            email_val = body.email.strip()
            if email_val:
                if "@" not in email_val:
                    email_val = f"{email_val}@daggle.local"
                local.email = email_val
        db.commit()
        db.refresh(local)

    return {"success": True}

