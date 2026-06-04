"""
Shared FastAPI dependency functions.

Usage in any router:
    @router.get("/datasets")
    async def list_datasets(
        user: dict = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        ...
"""

from typing import Annotated
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_oidc_token, extract_user_info


# ── Database ──────────────────────────────────────────────────

DbSession = Annotated[Session, Depends(get_db)]


# ── Auth ──────────────────────────────────────────────────────

def _get_token_from_session(request: Request) -> str:
    """
    Extract access token from the server-side session (set as HttpOnly cookie).
    The session middleware stores it after OIDC callback.
    """
    print(f"DEBUG AUTH: Request cookies: {dict(request.cookies)}")
    print(f"DEBUG AUTH: Request session keys: {list(request.session.keys()) if request.session else []}")
    token = request.session.get("access_token")
    if not token:
        print("DEBUG AUTH: access_token not found in session!")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
        )
    return token


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """
    Validate the session token against Keycloak JWKS and return user info dict.

    The returned dict has: sub, username, email, name, roles, email_verified
    """
    try:
        token = _get_token_from_session(request)
        payload = await verify_oidc_token(token)
        user_info = extract_user_info(payload)

        # Ensure a local User shadow record exists for the Keycloak identity
        from app.models import User
        local = db.query(User).filter(User.keycloak_id == user_info["sub"]).first()
        if not local:
            local = User(
                keycloak_id=user_info["sub"],
                username=user_info.get("username") or user_info["sub"],
                email=user_info.get("email") or "",
                display_name=user_info.get("name"),
            )
            db.add(local)
            db.commit()
            db.refresh(local)
        else:
            # Override token values with fresh local database values so updates reflect immediately
            if local.display_name:
                user_info["name"] = local.display_name
            if local.email:
                user_info["email"] = local.email

        return user_info
    except Exception as e:
        print(f"DEBUG AUTH: Verification failed: {e}")
        raise e


async def get_current_user_or_none(request: Request) -> dict | None:
    """Like get_current_user but returns None instead of 401 (for public endpoints)."""
    token = request.session.get("access_token")
    if not token:
        return None
    try:
        payload = await verify_oidc_token(token)
        return extract_user_info(payload)
    except HTTPException:
        return None


def require_role(role: str):
    """
    Dependency factory — require a specific Keycloak role.

    Usage:
        @router.delete("/datasets/{id}")
        async def delete_dataset(user = Depends(require_role("admin"))):
    """
    async def _check_role(user: dict = Depends(get_current_user)) -> dict:
        if role not in user.get("roles", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' required.",
            )
        return user
    return _check_role


# Convenience type aliases for annotated deps
CurrentUser = Annotated[dict, Depends(get_current_user)]
OptionalUser = Annotated[dict | None, Depends(get_current_user_or_none)]
