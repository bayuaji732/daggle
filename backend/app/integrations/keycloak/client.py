"""
Keycloak Admin REST API client.

Used for:
- Syncing user attributes from Keycloak → local DB shadow record
- Listing realm users (admin panel, future)
- Adding/removing realm roles programmatically

This is optional — the OIDC flow itself is handled by core/security.py.
"""

import httpx
import structlog
from typing import Optional

from app.core.config import settings

log = structlog.get_logger(__name__)


class KeycloakAdminClient:
    """
    Thin wrapper around the Keycloak Admin REST API.
    Authenticates as a service account using client_credentials grant.
    """

    def __init__(self):
        self.base_url = f"{settings.keycloak_realm_url}/admin/realms/{settings.KEYCLOAK_REALM}"
        self._token: Optional[str] = None

    async def _get_admin_token(self) -> str:
        """Fetch a short-lived admin token via client_credentials."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.keycloak_token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.KEYCLOAK_CLIENT_ID,
                    "client_secret": settings.KEYCLOAK_CLIENT_SECRET,
                },
            )
            resp.raise_for_status()
            return resp.json()["access_token"]

    async def get_user(self, keycloak_id: str) -> Optional[dict]:
        """Fetch a Keycloak user by their UUID (sub claim)."""
        token = await self._get_admin_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/users/{keycloak_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    async def list_users(self, search: Optional[str] = None, max_results: int = 50) -> list:
        """List realm users (admin only)."""
        token = await self._get_admin_token()
        params = {"max": max_results}
        if search:
            params["search"] = search
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/users",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
            )
        resp.raise_for_status()
        return resp.json()
