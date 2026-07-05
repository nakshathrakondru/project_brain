"""
JWT verification for Clerk tokens.
Dynamically derives the JWKS URL from the token's `iss` claim,
so it works regardless of which Clerk instance issued the token.
"""
import httpx
import time
import logging
from jose import jwt, JWTError
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import get_settings

settings = get_settings()
security = HTTPBearer()
log = logging.getLogger("security")

# Per-issuer JWKS cache: { issuer_url: {"keys": [...], "fetched_at": float} }
_jwks_cache: dict[str, dict] = {}
_JWKS_TTL = 300  # 5 minutes


def _jwks_url_from_issuer(issuer: str) -> str:
    """Convert a Clerk issuer URL to its JWKS endpoint."""
    return f"{issuer.rstrip('/')}/.well-known/jwks.json"


async def _get_jwks(issuer: str) -> list[dict]:
    """Fetch and cache JWKS keys for a given issuer."""
    now = time.time()
    cached = _jwks_cache.get(issuer, {})
    if cached.get("keys") and now - cached.get("fetched_at", 0) < _JWKS_TTL:
        return cached["keys"]

    jwks_url = _jwks_url_from_issuer(issuer)
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(jwks_url, timeout=10)
            resp.raise_for_status()
            keys = resp.json().get("keys", [])
            _jwks_cache[issuer] = {"keys": keys, "fetched_at": now}
            log.info("Fetched %d JWKS keys from %s", len(keys), jwks_url)
            return keys
    except Exception as e:
        log.error("Failed to fetch JWKS from %s: %s", jwks_url, e)
        return cached.get("keys", [])  # Return stale cache on error


async def verify_clerk_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    try:
        # Get issuer from unverified claims to find the right JWKS
        unverified = jwt.get_unverified_claims(token)
        issuer = unverified.get("iss", "")
        if not issuer:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing issuer")

        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        keys = await _get_jwks(issuer)
        matching_key = next((k for k in keys if k.get("kid") == kid), None)

        if not matching_key:
            # Cache may be stale — force refresh once
            _jwks_cache.pop(issuer, None)
            keys = await _get_jwks(issuer)
            matching_key = next((k for k in keys if k.get("kid") == kid), None)

        if not matching_key:
            log.error("No matching key. kid=%s, issuer=%s, available=%s",
                      kid, issuer, [k.get("kid") for k in keys])
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

    except HTTPException:
        raise
    except JWTError as e:
        log.error("JWT verification failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
    except Exception as e:
        log.error("Unexpected auth error: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Auth error: {str(e)}",
        )


async def get_current_user_id(payload: dict = Depends(verify_clerk_token)) -> str:
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )
    return user_id
