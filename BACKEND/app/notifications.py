from typing import Optional

from sqlalchemy.orm import Session

from app import models


def notify_employers(
    db: Session,
    *,
    organization_id,
    type: str,
    title: str,
    body: str,
    link: Optional[str] = None,
    interview_id=None,
) -> None:
    """Queues one notification per employer in the organization. Does not commit —
    the caller commits it together with the change that triggered it."""
    employers = (
        db.query(models.User.id)
        .filter(
            models.User.organization_id == organization_id,
            models.User.role == models.UserRole.EMPLOYER,
        )
        .all()
    )
    for (user_id,) in employers:
        db.add(
            models.Notification(
                user_id=user_id,
                organization_id=organization_id,
                interview_id=interview_id,
                type=type,
                title=title,
                body=body,
                link=link,
            )
        )
