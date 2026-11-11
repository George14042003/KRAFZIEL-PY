"""The subscription price template: defaults in code, an optional super-admin override in the database."""

import copy
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import models

MODES = ("bot", "video", "both")
CURRENCY = "inr"
MODE_LABELS = {"bot": "Bot interviews", "video": "Video interviews", "both": "Bot + video interviews"}
PLAN_KEYS = ("free", "starter", "growth", "enterprise")
LIVE_STATUSES = (
    models.SubscriptionStatus.ACTIVE,
    models.SubscriptionStatus.TRIALING,
    models.SubscriptionStatus.PAST_DUE,
)
CATALOG_ROW_ID = 1


def is_live(sub) -> bool:
    """A live status, and for demo / admin-assigned plans (no Stripe subscription) not past their end date.
    Stripe-backed subscriptions stay governed by webhook status alone."""
    from datetime import datetime

    if sub is None or sub.status not in LIVE_STATUSES:
        return False
    if not sub.stripe_subscription_id and sub.current_period_end is not None and sub.current_period_end < datetime.utcnow():
        return False
    return True


def _offer(monthly_rupees: int, bot: int, video: int) -> dict:
    return {"monthly_paise": monthly_rupees * 100, "bot": bot, "video": video}


# Prices in INR paise (Rs 1 = 100). Each paid plan is sold in three packs: bot only, video only, or both
# together (the bundle is priced below the sum of the two). Annual billing takes `annual_discount` off 12 months.
DEFAULT_CATALOG: dict = {
    "annual_discount": 0.2,
    "plans": {
        "free": {
            "name": "Free",
            "limits": {"jobs": 1, "candidates": 25},
            "offers": {"bot": _offer(0, 5, 0), "video": _offer(0, 0, 3), "both": _offer(0, 3, 2)},
        },
        "starter": {
            "name": "Starter",
            "limits": {"jobs": 3, "candidates": 150},
            "offers": {"bot": _offer(1499, 50, 0), "video": _offer(1999, 0, 25), "both": _offer(1799, 30, 15)},
        },
        "growth": {
            "name": "Growth",
            "limits": {"jobs": 15, "candidates": 1000},
            "offers": {"bot": _offer(4999, 250, 0), "video": _offer(5999, 0, 100), "both": _offer(6499, 150, 75)},
        },
        "enterprise": {
            "name": "Enterprise",
            "limits": {"jobs": None, "candidates": None},
            "offers": {"bot": _offer(14999, 1000, 0), "video": _offer(17999, 0, 400), "both": _offer(18999, 600, 300)},
        },
    },
}


def validate_catalog(data: Any) -> dict:
    """Return a clean copy of `data`, or raise 422 describing the first problem."""

    def bad(msg: str):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, msg)

    def whole(v, label: str, nullable: bool = False) -> Optional[int]:
        if v is None and nullable:
            return None
        if isinstance(v, bool) or not isinstance(v, int) or v < 0:
            bad(f"{label} must be a whole number of 0 or more" + (" (or empty for unlimited)." if nullable else "."))
        return v

    if not isinstance(data, dict) or not isinstance(data.get("plans"), dict):
        bad("Catalog must contain a plans object.")
    discount = data.get("annual_discount")
    if isinstance(discount, bool) or not isinstance(discount, (int, float)) or not 0 <= discount <= 0.9:
        bad("Annual discount must be between 0 and 0.9.")
    if set(data["plans"]) != set(PLAN_KEYS):
        bad(f"Plans must be exactly: {', '.join(PLAN_KEYS)}.")

    clean: dict = {"annual_discount": float(discount), "plans": {}}
    for key in PLAN_KEYS:
        p = data["plans"][key]
        name = p.get("name") if isinstance(p, dict) else None
        if not isinstance(name, str) or not name.strip() or len(name) > 40:
            bad(f"{key}: name is required (40 characters max).")
        limits = p.get("limits") or {}
        offers = p.get("offers") or {}
        if set(offers) != set(MODES):
            bad(f"{name}: offers must be exactly bot, video and both.")
        clean_offers = {}
        for mode in MODES:
            o = offers[mode]
            monthly = whole(o.get("monthly_paise"), f"{name} / {mode}: monthly price")
            bot = whole(o.get("bot"), f"{name} / {mode}: bot interviews")
            video = whole(o.get("video"), f"{name} / {mode}: video interviews")
            if key == "free" and monthly != 0:
                bad("The Free plan must cost 0.")
            if key != "free" and monthly == 0:
                bad(f"{name} / {mode}: a paid plan needs a price above 0.")
            if mode == "bot" and video:
                bad(f"{name} / bot only: video interviews must be 0.")
            if mode == "video" and bot:
                bad(f"{name} / video only: bot interviews must be 0.")
            clean_offers[mode] = {"monthly_paise": monthly, "bot": bot, "video": video}
        clean["plans"][key] = {
            "name": name.strip(),
            "limits": {
                "jobs": whole(limits.get("jobs"), f"{name}: job limit", nullable=True),
                "candidates": whole(limits.get("candidates"), f"{name}: candidate limit", nullable=True),
            },
            "offers": clean_offers,
        }
    return clean


def load_catalog(db: Session) -> dict:
    """The live catalog: the saved override if it is valid, otherwise the defaults."""
    try:
        row = db.get(models.BillingCatalog, CATALOG_ROW_ID)
    except SQLAlchemyError:
        db.rollback()  # billing_catalog table not migrated yet: run on the defaults
        return copy.deepcopy(DEFAULT_CATALOG)
    if row is not None:
        try:
            return validate_catalog(row.data)
        except HTTPException:
            pass
    return copy.deepcopy(DEFAULT_CATALOG)


def unit_amount(catalog: dict, plan_key: str, mode: str, interval: str) -> int:
    monthly = catalog["plans"][plan_key]["offers"][mode]["monthly_paise"]
    return round(monthly * 12 * (1 - catalog["annual_discount"])) if interval == "year" else monthly
