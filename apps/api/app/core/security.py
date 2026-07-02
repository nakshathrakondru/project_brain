"""
JWT verification for Clerk tokens.
Clerk issues standard RS256 JWTs. We fetch Clerk's JWKS and verify locally.
"""
import httpx
from jose import jwt, JWTError
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import get_settings
from functools import lru_cache
import time

settings = get_settings()

security = HTTPBearer()

CLERK_JWKS_URL = "https://api.clerk.dev/v1/jwks"

# Simple in-memory JWKS cache (refresh every 15 min)
_jwks_cache: dict = {"keys": [], "fetched_at": 0}
_JWKS_TTL = 900  # seconds


async def _get_jwks() -> list[dict]:
    now = time.time()
    if now - _jwks_cache["fetched_at"] < _JWKS_TTL and _jwks_cache["keys"]:
        return _jwks_cache["keys"]

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            CLERK_JWKS_URL,
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        _jwks_cache["keys"] = data.get("keys", [])
        _jwks_cache["fetched_at"] = now
        return _jwks_cache["keys"]


async def verify_clerk_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    try:
        # Decode header to get kid, then find matching key
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        keys = await _get_jwks()
        matching_key = next((k for k in keys if k.get("kid") == kid), None)
        if not matching_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find matching public key",
            )

        payload = jwt.decode(
            token,
            matching_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )


async def get_current_user_id(payload: dict = Depends(verify_clerk_token)) -> str:
    """Extracts the Clerk user ID (sub claim) from a verified token."""
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )
    return user_id
