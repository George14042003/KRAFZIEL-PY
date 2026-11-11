from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import models
from app.catalog import (
    CATALOG_ROW_ID,
    CURRENCY,
    DEFAULT_CATALOG,
    LIVE_STATUSES,
    is_live,
    MODES,
    PLAN_KEYS,
    load_catalog,
    unit_amount,
    validate_catalog,
)
from app.database import get_db
from app.entitlements import current_entitlements, usage_summary
from app.routers.billing import DEMO_MARKER
from app.security import require_super_admin

router = APIRouter(prefix="/admin/billing", tags=["super-admin-billing"])


class AssignPlanIn(BaseModel):
    plan: str
    mode: str = "both"
    interval: str = "month"
    # Days the assignment lasts; omit for no end date.
    days: Optional[int] = None


NEEDS_MIGRATION = "The pricing table hasn't been created in the database yet. Run the database update (update-backend.ps1), then try again."


def _saved_row(db: Session):
    """The super admin's saved prices, or None. Tolerates the table not existing yet (before the migration)."""
    try:
        return db.get(models.BillingCatalog, CATALOG_ROW_ID)
    except SQLAlchemyError:
        db.rollback()
        return None


@router.get("/catalog")
def get_catalog(_admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    row = _saved_row(db)
    return {
        "currency": CURRENCY,
        "catalog": load_catalog(db),
        "is_custom": row is not None,
        "updated_at": row.updated_at if row else None,
    }


@router.put("/catalog")
def save_catalog(body: dict[str, Any], admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    clean = validate_catalog(body)
    try:
        row = db.get(models.BillingCatalog, CATALOG_ROW_ID)
        if row is None:
            row = models.BillingCatalog(id=CATALOG_ROW_ID, data=clean, updated_by=admin.id)
            db.add(row)
        else:
            row.data = clean
            row.updated_by = admin.id
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NEEDS_MIGRATION)
    return {"currency": CURRENCY, "catalog": clean, "is_custom": True, "updated_at": row.updated_at}


@router.delete("/catalog")
def reset_catalog(_admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    row = _saved_row(db)
    if row is not None:
        db.delete(row)
        db.commit()
    return {"currency": CURRENCY, "catalog": DEFAULT_CATALOG, "is_custom": False, "updated_at": None}


@router.get("/overview")
def overview(_admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    cat = load_catalog(db)
    subs = {s.organization_id: s for s in db.query(models.Subscription).all()}
    rows = []
    mrr = 0
    paid_orgs = 0
    for org in db.query(models.Organization).order_by(models.Organization.created_at.desc()).all():
        sub = subs.get(org.id)
        live = is_live(sub) and sub.plan_key in cat["plans"]
        plan_key = sub.plan_key if live else "free"
        mode = sub.interview_mode if live and sub.interview_mode in MODES else "both"
        plan = cat["plans"][plan_key]
        offer = plan["offers"][mode]
        monthly_value = 0
        demo = bool(live and sub.stripe_customer_id == DEMO_MARKER and not sub.stripe_subscription_id)
        ent = current_entitlements(db, org.id)
        # Revenue only counts plans paid through the gateway, not ones assigned by hand or demo ones.
        if live and plan_key != "free" and not demo:
            paid_orgs += 1
            if sub.stripe_subscription_id:
                monthly_value = round(unit_amount(cat, plan_key, mode, sub.billing_interval or "month") / (12 if sub.billing_interval == "year" else 1))
                mrr += monthly_value
        rows.append(
            {
                "organization_id": str(org.id),
                "organization_name": org.name,
                "organization_status": org.status.value,
                "plan": plan_key,
                "plan_name": plan["name"],
                "mode": mode,
                "status": sub.status.value if sub else "free",
                "interval": sub.billing_interval if sub else None,
                "current_period_end": sub.current_period_end if sub else None,
                "cancel_at_period_end": bool(sub and sub.cancel_at_period_end),
                "assigned_by_admin": bool(live and not sub.stripe_subscription_id and not demo),
                "demo": demo,
                "monthly_paise": monthly_value,
                "limits": {"jobs": ent["jobs"], "candidates": ent["candidates"], "bot_interviews": ent["bot"], "video_interviews": ent["video"]},
                "usage": usage_summary(db, org.id),
            }
        )

    since = datetime.utcnow() - timedelta(days=30)
    recent = db.query(models.Payment).filter(models.Payment.created_at >= since).all()
    return {
        "currency": CURRENCY,
        "totals": {
            "organizations": len(rows),
            "paid_organizations": paid_orgs,
            "mrr_paise": mrr,
            "collected_30d_paise": sum(p.amount_cents for p in recent if p.status == "paid"),
            "failed_30d": sum(1 for p in recent if p.status == "failed"),
            "past_due": sum(1 for r in rows if r["status"] == "past_due"),
        },
        "organizations": rows,
    }


@router.get("/payments")
def all_payments(_admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(models.Payment, models.Organization.name)
        .join(models.Organization, models.Payment.organization_id == models.Organization.id)
        .order_by(models.Payment.created_at.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": str(p.id),
            "organization_name": name,
            "amount_cents": p.amount_cents,
            "currency": p.currency,
            "status": p.status,
            "description": p.description,
            "invoice_url": p.invoice_url,
            "paid_at": p.paid_at,
            "created_at": p.created_at,
        }
        for p, name in rows
    ]


@router.put("/organizations/{org_id}/plan")
def assign_plan(
    org_id: str,
    body: AssignPlanIn,
    _admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Give an organization a plan by hand (trial, goodwill, offline invoice), or put it back on Free."""
    org = db.get(models.Organization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found.")
    cat = load_catalog(db)
    if body.plan not in PLAN_KEYS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown plan.")
    if body.mode not in MODES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mode must be bot, video or both.")
    if body.interval not in ("month", "year"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Interval must be month or year.")
    if body.days is not None and not 1 <= body.days <= 3650:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Days must be between 1 and 3650.")

    sub = db.query(models.Subscription).filter_by(organization_id=org.id).first()
    if sub is not None and sub.stripe_subscription_id and sub.status in LIVE_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This organization pays through the gateway. Cancel or change it from the customer's billing portal first.",
        )

    if body.plan == "free":
        if sub is not None:
            sub.status = models.SubscriptionStatus.CANCELED
            sub.current_period_end = None
        db.commit()
        return {"organization_id": str(org.id), "plan": "free", "plan_name": cat["plans"]["free"]["name"]}

    if sub is None:
        sub = models.Subscription(organization_id=org.id, plan_key=body.plan)
        db.add(sub)
    sub.plan_key = body.plan
    sub.interview_mode = body.mode
    sub.billing_interval = body.interval
    sub.status = models.SubscriptionStatus.ACTIVE
    sub.cancel_at_period_end = False
    sub.stripe_subscription_id = None
    if sub.stripe_customer_id == DEMO_MARKER:
        sub.stripe_customer_id = None
    sub.current_period_end = datetime.utcnow() + timedelta(days=body.days) if body.days else None
    db.commit()
    return {"organization_id": str(org.id), "plan": body.plan, "plan_name": cat["plans"][body.plan]["name"]}
