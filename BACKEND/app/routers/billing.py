import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timedelta
from typing import Literal, Optional

import httpx
from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.catalog import CURRENCY, LIVE_STATUSES, is_live, MODE_LABELS, MODES, PLAN_KEYS, load_catalog, unit_amount
from app.database import get_db
from app.security import require_employer

router = APIRouter(prefix="/billing", tags=["billing"])

STRIPE_API = "https://api.stripe.com/v1"
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
WEBHOOK_TOLERANCE_SECONDS = 300
# A demo subscription has stripe_customer_id == DEMO_MARKER and no stripe_subscription_id. No schema change needed.
DEMO_MARKER = "demo"


def _stripe(method: str, path: str, data: Optional[dict] = None) -> dict:
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Payments are not configured yet.")
    try:
        res = httpx.request(method, f"{STRIPE_API}{path}", data=data, auth=(STRIPE_SECRET_KEY, ""), timeout=20)
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not reach the payment gateway.")
    body = res.json()
    if res.status_code >= 400:
        msg = (body.get("error") or {}).get("message") or "Payment gateway error."
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, msg)
    return body


def _ts(value) -> Optional[datetime]:
    return datetime.utcfromtimestamp(value) if value else None


class CheckoutIn(BaseModel):
    plan: str
    mode: str = "both"
    interval: str = "month"


class DemoSubscribeIn(BaseModel):
    plan: Literal["free", "starter", "growth", "enterprise"]
    mode: Literal["bot", "video", "both"] = "both"
    interval: Literal["month", "year"] = "month"


class UrlOut(BaseModel):
    url: str


def _gateway() -> str:
    return "stripe" if STRIPE_SECRET_KEY else "none"


def demo_mode() -> bool:
    """Demo subscriptions are offered while no payment gateway is configured, or when DEMO_SUBSCRIPTIONS is on."""
    forced = os.environ.get("DEMO_SUBSCRIPTIONS", "").strip().lower() in ("1", "true", "yes", "on")
    return forced or not STRIPE_SECRET_KEY


def _is_live(sub: Optional[models.Subscription]) -> bool:
    return is_live(sub)


def _is_demo(sub: Optional[models.Subscription]) -> bool:
    return _is_live(sub) and sub.stripe_customer_id == DEMO_MARKER and not sub.stripe_subscription_id


def _is_real(sub: Optional[models.Subscription]) -> bool:
    return _is_live(sub) and bool(sub.stripe_subscription_id)


def _is_admin_assigned(sub: Optional[models.Subscription]) -> bool:
    return _is_live(sub) and not sub.stripe_subscription_id and not _is_demo(sub)


@router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    """Public price template, so the pricing page and billing page agree with the server."""
    cat = load_catalog(db)
    return {
        "currency": CURRENCY,
        "demo_mode": demo_mode(),
        "gateway": _gateway(),
        "annual_discount": cat["annual_discount"],
        "plans": [
            {
                "key": key,
                "name": p["name"],
                "limits": p["limits"],
                "offers": {
                    mode: {
                        "monthly_paise": o["monthly_paise"],
                        "annual_paise": unit_amount(cat, key, mode, "year"),
                        "bot_interviews": o["bot"],
                        "video_interviews": o["video"],
                    }
                    for mode, o in p["offers"].items()
                },
            }
            for key, p in cat["plans"].items()
        ],
    }


def _subscription_payload(db: Session, org_id) -> dict:
    from app.entitlements import current_entitlements, org_limits_enforced, usage_summary  # imported here: entitlements imports this package

    sub = db.query(models.Subscription).filter_by(organization_id=org_id).first()
    ent = current_entitlements(db, org_id)
    demo = _is_demo(sub)
    return {
        "plan": ent["plan_key"],
        "plan_name": ent["plan_name"],
        "mode": ent["mode"],
        "limits": {"jobs": ent["jobs"], "candidates": ent["candidates"], "bot_interviews": ent["bot"], "video_interviews": ent["video"]},
        "status": sub.status.value if sub else "free",
        "interval": sub.billing_interval if sub else None,
        "current_period_end": sub.current_period_end if sub else None,
        "cancel_at_period_end": bool(sub and sub.cancel_at_period_end),
        "assigned_by_admin": bool(_is_live(sub) and not sub.stripe_subscription_id and not demo),
        "demo": demo,
        "demo_available": demo_mode() and not _is_real(sub) and not _is_admin_assigned(sub),
        "gateway": _gateway(),
        "gateway_configured": bool(STRIPE_SECRET_KEY),
        "limits_enforced": org_limits_enforced(db, org_id),
        "usage": usage_summary(db, org_id),
    }


@router.get("/subscription")
def my_subscription(employer: models.User = Depends(require_employer), db: Session = Depends(get_db)):
    return _subscription_payload(db, employer.organization_id)


@router.post("/demo-subscribe")
def demo_subscribe(body: DemoSubscribeIn, employer: models.User = Depends(require_employer), db: Session = Depends(get_db)):
    """Pick any plan with no payment, so the plan's benefits apply until a real gateway exists."""
    org_id = employer.organization_id
    if org_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your account has no organization.")
    if not demo_mode():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Demo subscriptions are not available.")
    cat = load_catalog(db)
    if body.plan not in PLAN_KEYS or body.plan not in cat["plans"] or body.mode not in MODES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown plan or interview mode.")
    sub = db.query(models.Subscription).filter_by(organization_id=org_id).first()
    if _is_real(sub):
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have a paid subscription. Use Manage billing to change it.")
    if _is_admin_assigned(sub):
        raise HTTPException(status.HTTP_409_CONFLICT, "Your plan was set by our team. Contact support to change it.")
    if sub is None:
        sub = models.Subscription(organization_id=org_id, plan_key=body.plan)
        db.add(sub)
    sub.plan_key = body.plan
    sub.interview_mode = body.mode
    sub.billing_interval = body.interval
    sub.status = models.SubscriptionStatus.ACTIVE
    sub.cancel_at_period_end = False
    sub.stripe_customer_id = DEMO_MARKER
    sub.stripe_subscription_id = None
    sub.current_period_end = datetime.utcnow() + timedelta(days=365 if body.interval == "year" else 30)
    db.commit()
    return _subscription_payload(db, org_id)


@router.post("/demo-cancel")
def demo_cancel(employer: models.User = Depends(require_employer), db: Session = Depends(get_db)):
    """End a demo subscription and go back to unlimited Early access."""
    sub = db.query(models.Subscription).filter_by(organization_id=employer.organization_id).first()
    if not _is_demo(sub):
        raise HTTPException(status.HTTP_409_CONFLICT, "You do not have a demo subscription to cancel.")
    sub.status = models.SubscriptionStatus.CANCELED
    sub.current_period_end = None
    sub.cancel_at_period_end = False
    db.commit()
    return _subscription_payload(db, employer.organization_id)


@router.get("/payments")
def my_payments(employer: models.User = Depends(require_employer), db: Session = Depends(get_db)):
    rows = (
        db.query(models.Payment)
        .filter_by(organization_id=employer.organization_id)
        .order_by(models.Payment.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "amount_cents": r.amount_cents,
            "currency": r.currency,
            "status": r.status,
            "description": r.description,
            "invoice_url": r.invoice_url,
            "paid_at": r.paid_at,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.post("/checkout", response_model=UrlOut)
def create_checkout(body: CheckoutIn, employer: models.User = Depends(require_employer), db: Session = Depends(get_db)):
    cat = load_catalog(db)
    if body.plan not in cat["plans"] or body.plan == "free":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a paid plan.")
    if body.mode not in MODES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mode must be bot, video or both.")
    if body.interval not in ("month", "year"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Interval must be month or year.")
    org_id = employer.organization_id
    if org_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your account has no organization.")

    sub = db.query(models.Subscription).filter_by(organization_id=org_id).first()
    if sub and sub.status in LIVE_STATUSES and sub.stripe_subscription_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have a subscription. Use Manage billing to change it.")

    form = {
        "mode": "subscription",
        "success_url": f"{FRONTEND_URL}/employer/billing?checkout=success",
        "cancel_url": f"{FRONTEND_URL}/employer/billing?checkout=cancelled",
        "client_reference_id": str(org_id),
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": CURRENCY,
        "line_items[0][price_data][unit_amount]": str(unit_amount(cat, body.plan, body.mode, body.interval)),
        "line_items[0][price_data][recurring][interval]": body.interval,
        "line_items[0][price_data][product_data][name]": f"Elzuron {cat['plans'][body.plan]['name']} ({MODE_LABELS[body.mode]})",
        "subscription_data[metadata][organization_id]": str(org_id),
        "subscription_data[metadata][plan]": body.plan,
        "subscription_data[metadata][mode]": body.mode,
        "subscription_data[metadata][interval]": body.interval,
    }
    if sub and sub.stripe_customer_id and sub.stripe_customer_id != DEMO_MARKER:
        form["customer"] = sub.stripe_customer_id
    else:
        form["customer_email"] = employer.email
    session = _stripe("POST", "/checkout/sessions", form)
    return UrlOut(url=session["url"])


@router.post("/portal", response_model=UrlOut)
def create_portal(employer: models.User = Depends(require_employer), db: Session = Depends(get_db)):
    sub = db.query(models.Subscription).filter_by(organization_id=employer.organization_id).first()
    if not sub or not sub.stripe_customer_id or sub.stripe_customer_id == DEMO_MARKER:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No billing account yet. Subscribe to a plan first.")
    session = _stripe(
        "POST",
        "/billing_portal/sessions",
        {"customer": sub.stripe_customer_id, "return_url": f"{FRONTEND_URL}/employer/billing"},
    )
    return UrlOut(url=session["url"])


# ---------- webhook ----------

def _verify_signature(payload: bytes, header: str) -> None:
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Webhook secret is not configured.")
    parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
    timestamp, signature = parts.get("t"), parts.get("v1")
    if not timestamp or not signature:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bad signature header.")
    expected = hmac.new(STRIPE_WEBHOOK_SECRET.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature.")
    try:
        age = abs(time.time() - int(timestamp))
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bad signature header.")
    if age > WEBHOOK_TOLERANCE_SECONDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Stale webhook.")


_STATUS_MAP = {
    "active": models.SubscriptionStatus.ACTIVE,
    "trialing": models.SubscriptionStatus.TRIALING,
    "past_due": models.SubscriptionStatus.PAST_DUE,
    "canceled": models.SubscriptionStatus.CANCELED,
}


def _apply_subscription(db: Session, obj: dict, org_id: Optional[str] = None) -> Optional[models.Subscription]:
    meta = obj.get("metadata") or {}
    org_id = org_id or meta.get("organization_id")
    sub = db.query(models.Subscription).filter_by(stripe_subscription_id=obj["id"]).first()
    if sub is None and org_id:
        sub = db.query(models.Subscription).filter_by(organization_id=org_id).first()
        if sub is None:
            sub = models.Subscription(organization_id=org_id, plan_key=meta.get("plan", "growth"))
            db.add(sub)
    if sub is None:
        return None
    first_item = ((obj.get("items") or {}).get("data") or [{}])[0]
    sub.stripe_subscription_id = obj["id"]
    sub.stripe_customer_id = obj.get("customer") or sub.stripe_customer_id
    sub.plan_key = meta.get("plan") or sub.plan_key
    sub.interview_mode = meta.get("mode") or sub.interview_mode or "both"
    sub.billing_interval = meta.get("interval") or sub.billing_interval or "month"
    sub.status = _STATUS_MAP.get(obj.get("status"), models.SubscriptionStatus.INCOMPLETE)
    sub.current_period_end = _ts(obj.get("current_period_end") or first_item.get("current_period_end"))
    sub.cancel_at_period_end = bool(obj.get("cancel_at_period_end"))
    return sub


def _record_invoice(db: Session, inv: dict, paid: bool) -> None:
    sub = db.query(models.Subscription).filter_by(stripe_customer_id=inv.get("customer")).first()
    if sub is None:
        # The customer is not stored yet (invoice arrived before the subscription event). Fail the webhook so
        # the event row rolls back and Stripe redelivers it later.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Subscription not recorded yet; retry later.")
    row = db.query(models.Payment).filter_by(stripe_invoice_id=inv["id"]).first()
    if row is None:
        row = models.Payment(
            stripe_invoice_id=inv["id"], organization_id=sub.organization_id, subscription_id=sub.id,
            amount_cents=0, status="failed",
        )
        db.add(row)
    row.amount_cents = inv.get("amount_paid", 0) if paid else inv.get("amount_due", 0)
    row.currency = inv.get("currency", CURRENCY)
    row.status = "paid" if paid else "failed"
    row.description = ((inv.get("lines") or {}).get("data") or [{}])[0].get("description")
    row.invoice_url = inv.get("hosted_invoice_url")
    row.paid_at = datetime.utcnow() if paid else None


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    # Blocking DB and Stripe API calls run in the threadpool so they cannot stall the event loop.
    return await run_in_threadpool(_handle_webhook, db, payload, request.headers.get("stripe-signature", ""))


def _handle_webhook(db: Session, payload: bytes, signature_header: str) -> dict:
    _verify_signature(payload, signature_header)
    try:
        event = json.loads(payload)
        event_id, kind, obj = event["id"], event["type"], event["data"]["object"]
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Malformed event.")

    db.add(models.PaymentWebhookEvent(id=event_id, type=kind))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"received": True, "duplicate": True}

    if kind == "checkout.session.completed" and obj.get("mode") == "subscription":
        stripe_sub = _stripe("GET", f"/subscriptions/{obj['subscription']}")
        _apply_subscription(db, stripe_sub, org_id=obj.get("client_reference_id"))
    elif kind in ("customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"):
        _apply_subscription(db, obj)
    elif kind == "invoice.paid":
        _record_invoice(db, obj, paid=True)
    elif kind == "invoice.payment_failed":
        _record_invoice(db, obj, paid=False)
    db.commit()
    return {"received": True}
