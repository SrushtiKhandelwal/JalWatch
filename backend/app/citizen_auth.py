"""Citizen identity and area selection, separate from the admin console session."""

import hashlib
import hmac
import secrets
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth import COOKIE_NAME as ADMIN_COOKIE_NAME, SESSION_SECONDS, _signature
from .config import settings
from .database import get_db
from .models import Citizen, Locality, Ward
from .schemas import (
    CitizenLocationUpdate, CitizenLogin, CitizenRegistration, CitizenResponse,
    LocalityResponse, WardResponse,
)


COOKIE_NAME = "jalwatch_citizen_session"
router = APIRouter(prefix="/auth/citizen", tags=["Citizen authentication"])
public_router = APIRouter(prefix="/public", tags=["Public area directory"])


def _password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    key = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1, maxmem=64 * 1024 * 1024)
    return f"scrypt$16384${salt.hex()}${key.hex()}"


def _password_matches(password: str, stored: str) -> bool:
    try:
        algorithm, cost, salt_hex, key_hex = stored.split("$", 3)
        if algorithm != "scrypt" or cost != "16384":
            return False
        candidate = _password_hash(password, bytes.fromhex(salt_hex))
        return hmac.compare_digest(candidate, stored)
    except (ValueError, TypeError):
        return False


def _set_cookie(response: Response, citizen_id: str) -> None:
    expiry = str(int(time.time()) + SESSION_SECONDS)
    nonce = secrets.token_hex(16)
    payload = f"citizen.{citizen_id}.{expiry}.{nonce}"
    response.set_cookie(
        COOKIE_NAME, f"{payload}.{_signature(payload)}",
        max_age=SESSION_SECONDS, path="/api", httponly=True,
        secure=settings.COOKIE_SECURE, samesite="strict",
    )
    response.delete_cookie(ADMIN_COOKIE_NAME, path="/api")


def require_citizen(request: Request, db: Session = Depends(get_db)) -> Citizen:
    if len(settings.SESSION_SECRET) < 32:
        raise HTTPException(status_code=503, detail="Sessions are not configured")
    try:
        role, citizen_id, expiry, nonce, signature = request.cookies.get(COOKIE_NAME, "").split(".", 4)
        payload = f"{role}.{citizen_id}.{expiry}.{nonce}"
        if role != "citizen" or int(expiry) <= int(time.time()) or not hmac.compare_digest(
            _signature(payload), signature
        ):
            raise ValueError("Invalid session")
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Sign in as a citizen") from None
    citizen = db.get(Citizen, citizen_id)
    if citizen is None:
        raise HTTPException(status_code=401, detail="Sign in as a citizen")
    return citizen


def _area(db: Session, ward_id: str, locality_id: str) -> tuple[Ward, Locality]:
    ward = db.get(Ward, ward_id)
    locality = db.get(Locality, locality_id)
    if ward is None or locality is None or locality.ward_id != ward_id:
        raise HTTPException(status_code=422, detail="Select a locality in the chosen ward")
    return ward, locality


def _profile(citizen: Citizen) -> CitizenResponse:
    return CitizenResponse(
        citizen_id=citizen.citizen_id, full_name=citizen.full_name,
        email=citizen.email, address=citizen.address, ward_id=citizen.ward_id,
        zone_id=citizen.ward.zone_id, locality_id=citizen.locality_id,
        location_status=citizen.location_status,
    )


@public_router.get("/wards", response_model=list[WardResponse])
def public_wards(db: Session = Depends(get_db)):
    return db.query(Ward).order_by(Ward.ward_number).all()


@public_router.get("/wards/{ward_id}/localities", response_model=list[LocalityResponse])
def public_localities(ward_id: str, db: Session = Depends(get_db)):
    if db.get(Ward, ward_id) is None:
        raise HTTPException(status_code=404, detail="Ward not found")
    return db.query(Locality).filter(Locality.ward_id == ward_id).order_by(Locality.locality_name).all()


@router.post("/register", response_model=CitizenResponse, status_code=201)
def register(data: CitizenRegistration, response: Response, db: Session = Depends(get_db)):
    if len(settings.SESSION_SECRET) < 32:
        raise HTTPException(status_code=503, detail="Sessions are not configured")
    ward, _ = _area(db, data.ward_id, data.locality_id)
    if db.query(Citizen).filter(Citizen.email == data.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    citizen = Citizen(
        citizen_id=f"CIT-U-{uuid4().hex[:16].upper()}",
        full_name=data.full_name, email=data.email,
        password_hash=_password_hash(data.password), address=data.address,
        ward_id=ward.ward_id, locality_id=data.locality_id,
        location_status="self_selected_unverified",
    )
    db.add(citizen)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists") from None
    db.refresh(citizen)
    _set_cookie(response, citizen.citizen_id)
    return _profile(citizen)


@router.post("/login", response_model=CitizenResponse)
def citizen_login(data: CitizenLogin, response: Response, db: Session = Depends(get_db)):
    if len(settings.SESSION_SECRET) < 32:
        raise HTTPException(status_code=503, detail="Sessions are not configured")
    citizen = db.query(Citizen).filter(Citizen.email == data.email.strip().lower()).first()
    if citizen is None or not _password_matches(data.password, citizen.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    _set_cookie(response, citizen.citizen_id)
    return _profile(citizen)


@router.get("/me", response_model=CitizenResponse)
def citizen_me(citizen: Citizen = Depends(require_citizen)):
    return _profile(citizen)


@router.patch("/location", response_model=CitizenResponse)
def update_location(
    data: CitizenLocationUpdate,
    citizen: Citizen = Depends(require_citizen),
    db: Session = Depends(get_db),
):
    _area(db, data.ward_id, data.locality_id)
    citizen.address = data.address
    citizen.ward_id = data.ward_id
    citizen.locality_id = data.locality_id
    citizen.location_status = "self_selected_unverified"
    db.commit()
    db.refresh(citizen)
    return _profile(citizen)


@router.post("/logout")
def citizen_logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/api")
    return {"authenticated": False}
