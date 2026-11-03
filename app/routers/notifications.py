from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import require_employer

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=schemas.NotificationListOut)
def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    base = db.query(models.Notification).filter(models.Notification.user_id == employer.id)
    unread_count = base.filter(models.Notification.read_at.is_(None)).count()
    items = base.order_by(models.Notification.created_at.desc()).limit(limit).all()
    return schemas.NotificationListOut(unread_count=unread_count, items=items)


@router.post("/notifications/read-all", response_model=schemas.MessageResponse)
def mark_all_notifications_read(
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == employer.id, models.Notification.read_at.is_(None)
    ).update({models.Notification.read_at: datetime.utcnow()}, synchronize_session=False)
    db.commit()
    return schemas.MessageResponse(detail="All notifications marked as read.")


@router.post("/notifications/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_notification_read(
    notification_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    notification = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id, models.Notification.user_id == employer.id)
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    if notification.read_at is None:
        notification.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notification)
    return notification
