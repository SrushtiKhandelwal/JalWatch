"""Service notices shown to citizens only after publication and area matching."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..citizen_auth import require_citizen
from ..database import get_db
from ..models import Citizen, NoticeRead, ServiceNotice, Ward
from ..schemas import ServiceNoticeAction, ServiceNoticeCreate, ServiceNoticeEdit, ServiceNoticeResponse

admin_router = APIRouter(prefix="/service-notices", tags=["Service notices"])
citizen_router = APIRouter(prefix="/citizen/notices", tags=["Citizen notices"])


def _utc(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        raise HTTPException(status_code=422, detail="Notice times must include a timezone")
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _validate(data: ServiceNoticeCreate | ServiceNoticeEdit, db: Session, enforce_future: bool = True) -> tuple[str | None, str | None, str | None]:
    ids = data.target_ids
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=422, detail="Target IDs must be unique")
    if data.target_kind == "citywide":
        if ids:
            raise HTTPException(status_code=422, detail="Citywide notices cannot have area IDs")
    else:
        if not ids:
            raise HTTPException(status_code=422, detail="Select at least one target area")
        existing = {
            row[0] for row in db.query(Ward.ward_id if data.target_kind == "wards" else Ward.zone_id).distinct().all()
        }
        if not set(ids).issubset(existing):
            raise HTTPException(status_code=422, detail="Unknown ward or zone ID")
    start, end, publish = _utc(data.starts_at), _utc(data.ends_at), _utc(data.publish_at)
    if start and end and end <= start:
        raise HTTPException(status_code=422, detail="End time must be after start time")
    if enforce_future and data.publication == "publish" and publish and publish <= _now():
        raise HTTPException(status_code=422, detail="Scheduled publication must be in the future")
    return start, end, publish


def _activate_due(db: Session) -> None:
    due = db.query(ServiceNotice).filter(
        ServiceNotice.status == "scheduled", ServiceNotice.publish_at <= _now()
    ).all()
    if due:
        for notice in due:
            notice.status = "published"
            notice.published_at = notice.publish_at
            notice.updated_at = _now()
        db.commit()


def _notice(db: Session, notice_id: int) -> ServiceNotice:
    notice = db.get(ServiceNotice, notice_id)
    if notice is None:
        raise HTTPException(status_code=404, detail="Service notice not found")
    return notice


def _targeted(notice: ServiceNotice, citizen: Citizen) -> bool:
    return notice.target_kind == "citywide" or (
        notice.target_kind == "wards" and citizen.ward_id in notice.target_ids
    ) or (notice.target_kind == "zones" and citizen.ward.zone_id in notice.target_ids)


@admin_router.get("", response_model=list[ServiceNoticeResponse])
def list_notices(db: Session = Depends(get_db)):
    _activate_due(db)
    return db.query(ServiceNotice).order_by(ServiceNotice.id.desc()).limit(200).all()


@admin_router.post("", response_model=ServiceNoticeResponse, status_code=201)
def create_notice(data: ServiceNoticeCreate, db: Session = Depends(get_db)):
    start, end, publish = _validate(data, db)
    now = _now()
    status = "draft" if data.publication == "draft" else ("scheduled" if publish else "published")
    notice = ServiceNotice(
        title=data.title, notice_type=data.notice_type, message=data.message,
        target_kind=data.target_kind, target_ids=data.target_ids,
        starts_at=start, ends_at=end, publish_at=publish, status=status,
        revision=1, created_at=now, updated_at=now,
        published_at=now if status == "published" else None,
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


@admin_router.put("/{notice_id}", response_model=ServiceNoticeResponse)
def edit_notice(notice_id: int, data: ServiceNoticeEdit, db: Session = Depends(get_db)):
    notice = _notice(db, notice_id)
    if notice.status == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled notices cannot be edited")
    start, end, publish = _validate(data, db, enforce_future=notice.status != "published")
    notice.title = data.title
    notice.notice_type = data.notice_type
    notice.message = data.message
    notice.target_kind = data.target_kind
    notice.target_ids = data.target_ids
    notice.starts_at = start
    notice.ends_at = end
    if notice.status in ("draft", "scheduled"):
        notice.publish_at = publish
        notice.status = "draft" if data.publication == "draft" else ("scheduled" if publish else "published")
        if notice.status == "published":
            notice.published_at = _now()
    notice.revision += 1
    notice.updated_at = _now()
    db.commit()
    db.refresh(notice)
    return notice


@admin_router.post("/{notice_id}/action", response_model=ServiceNoticeResponse)
def notice_action(notice_id: int, data: ServiceNoticeAction, db: Session = Depends(get_db)):
    notice = _notice(db, notice_id)
    if data.action == "cancel":
        if notice.status == "cancelled":
            raise HTTPException(status_code=409, detail="Notice is already cancelled")
        notice.status = "cancelled"
    else:
        if notice.status != "draft":
            raise HTTPException(status_code=409, detail="Only draft notices can be published")
        notice.status = "scheduled" if notice.publish_at and notice.publish_at > _now() else "published"
        if notice.status == "published":
            notice.published_at = _now()
    notice.revision += 1
    notice.updated_at = _now()
    db.commit()
    db.refresh(notice)
    return notice


@citizen_router.get("", response_model=list[ServiceNoticeResponse])
def citizen_notices(citizen: Citizen = Depends(require_citizen), db: Session = Depends(get_db)):
    _activate_due(db)
    notices = db.query(ServiceNotice).filter(
        ServiceNotice.status.in_(["published", "cancelled"]),
        ServiceNotice.published_at.is_not(None),
    ).order_by(ServiceNotice.id.desc()).all()
    ids = [notice.id for notice in notices]
    reads = {item.notice_id: item.read_revision for item in db.query(NoticeRead).filter(
        NoticeRead.citizen_id == citizen.citizen_id, NoticeRead.notice_id.in_(ids)
    ).all()} if ids else {}
    return [
        ServiceNoticeResponse.model_validate(notice).model_copy(update={"is_read": reads.get(notice.id, 0) >= notice.revision})
        for notice in notices if _targeted(notice, citizen)
    ]


@citizen_router.post("/{notice_id}/read", response_model=ServiceNoticeResponse)
def mark_notice_read(
    notice_id: int, citizen: Citizen = Depends(require_citizen), db: Session = Depends(get_db),
):
    _activate_due(db)
    notice = _notice(db, notice_id)
    if notice.status not in ("published", "cancelled") or not _targeted(notice, citizen):
        raise HTTPException(status_code=404, detail="Service notice not found")
    read = db.query(NoticeRead).filter(
        NoticeRead.notice_id == notice_id, NoticeRead.citizen_id == citizen.citizen_id,
    ).first()
    if read is None:
        read = NoticeRead(notice_id=notice_id, citizen_id=citizen.citizen_id)
        db.add(read)
    read.read_revision = notice.revision
    read.read_at = _now()
    db.commit()
    return ServiceNoticeResponse.model_validate(notice).model_copy(update={"is_read": True})
