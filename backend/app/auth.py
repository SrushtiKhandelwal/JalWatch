"""Single-administrator access for the operations console.

Credentials come from environment variables. Sessions are short-lived signed,
HTTP-only cookies; no password or token is embedded in the browser bundle.
"""

import hashlib
import hmac
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from .config import settings


COOKIE_NAME = "jalwatch_session"
SESSION_SECONDS = 8 * 60 * 60
router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1)


def access_configured() -> bool:
    return len(settings.ADMIN_PASSWORD) >= 12 and len(settings.SESSION_SECRET) >= 32


def _signature(message: str) -> str:
    return hmac.new(
        settings.SESSION_SECRET.encode("utf-8"), message.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def require_session(request: Request) -> None:
    if not access_configured():
        raise HTTPException(status_code=503, detail="Administrator credentials are not configured")
    token = request.cookies.get(COOKIE_NAME, "")
    try:
        expiry, nonce, signature = token.split(".", 2)
        if int(expiry) <= int(time.time()) or not hmac.compare_digest(
            _signature(f"{expiry}.{nonce}"), signature
        ):
            raise ValueError("Invalid session")
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Sign in to access JalWatch") from None


@router.get("/me", dependencies=[Depends(require_session)])
def current_session():
    return {"authenticated": True}


@router.post("/login")
def login(credentials: LoginRequest, response: Response):
    if not access_configured():
        raise HTTPException(status_code=503, detail="Administrator credentials are not configured")
    if not secrets.compare_digest(credentials.password, settings.ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Incorrect administrator password")
    expiry = str(int(time.time()) + SESSION_SECONDS)
    nonce = secrets.token_hex(16)
    response.set_cookie(
        COOKIE_NAME,
        f"{expiry}.{nonce}.{_signature(f'{expiry}.{nonce}')}",
        max_age=SESSION_SECONDS,
        path="/api",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
    )
    return {"authenticated": True}


@router.post("/logout", dependencies=[Depends(require_session)])
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/api")
    return {"authenticated": False}
