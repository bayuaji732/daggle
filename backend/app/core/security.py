"""
OIDC token validation against Keycloak's public JWKS endpoint.

Flow:
  Browser → FastAPI (HttpOnly session cookie)
  FastAPI → reads access_token from session
  FastAPI → validates token against Keycloak JWKS (public key, no shared secret)
  FastAPI → returns user payload

Kubeflow migration path:
  Change KEYCLOAK_URL + KEYCLOAK_REALM env vars → zero code changes.
"""

import httpx
from jose import jwt, JWTError
from fastapi import HTTPException, status
from app.core.config import settings

# Cache JWKS in memory — Keycloak keys rotate rarely
_jwks_cache: dict | None = None


async def _get_jwks() -> dict:
    """Fetch Keycloak's public JWKS (with simple in-process cache)."""
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(settings.keycloak_jwks_url, timeout=10)
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


def invalidate_jwks_cache() -> None:
    """Call this if you rotate Keycloak keys."""
    global _jwks_cache
    _jwks_cache = None


async def verify_oidc_token(token: str) -> dict:
    """
    Validate a Keycloak-issued JWT access token.

    Returns the decoded payload dict on success.
    Raises HTTP 401 on any validation failure.
    """
    try:
        jwks = await _get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_exp": False, "verify_aud": False},
        )
        # Check that the token was issued to/intended for our client.
        # Keycloak access tokens often set the audience to "account" or other resource scopes,
        # while storing the client ID in the authorized party ("azp") claim.
        if (
            payload.get("azp") != settings.KEYCLOAK_CLIENT_ID
            and payload.get("aud") != settings.KEYCLOAK_CLIENT_ID
        ):
            raise JWTError("Invalid audience or authorized party")
            
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def extract_user_info(payload: dict) -> dict:
    """
    Extract normalized user info from Keycloak JWT payload.

    Keycloak standard claims:
      sub         → user ID (stable UUID)
      preferred_username → username
      email       → email
      realm_access.roles → realm-level roles
      resource_access.<client>.roles → client-level roles
    """
    realm_roles = payload.get("realm_access", {}).get("roles", [])
    client_roles = (
        payload.get("resource_access", {})
        .get(settings.KEYCLOAK_CLIENT_ID, {})
        .get("roles", [])
    )
    return {
        "sub": payload["sub"],
        "username": payload.get("preferred_username"),
        "email": payload.get("email"),
        "name": payload.get("name"),
        "roles": list(set(realm_roles + client_roles)),
        "email_verified": payload.get("email_verified", False),
    }
