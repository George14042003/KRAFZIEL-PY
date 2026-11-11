"""How many look-away warnings a bot interview allows, from the role's experience level.

The role's required experience (set when the job is posted) decides it; when the job doesn't say, the candidate's
own experience from their parsed resume is used. Anything beyond the allowance ends the interview."""

from typing import Optional

FRESHER_WARNINGS = 2
EXPERIENCED_WARNINGS = 2   # more than 5 years
SENIOR_WARNINGS = 5        # more than 8 years
DEFAULT_WARNINGS = 2

SENIOR_AFTER_YEARS = 8
EXPERIENCED_AFTER_YEARS = 5
FRESHER_BELOW_YEARS = 1


def warning_policy(job_years: Optional[int], resume_years: Optional[float]) -> dict:
    years: Optional[float] = float(job_years) if job_years is not None else resume_years
    if years is None:
        return {"experience_level": "unspecified", "max_warnings": DEFAULT_WARNINGS, "years": None}
    if years > SENIOR_AFTER_YEARS:
        return {"experience_level": "senior", "max_warnings": SENIOR_WARNINGS, "years": years}
    if years > EXPERIENCED_AFTER_YEARS:
        return {"experience_level": "experienced", "max_warnings": EXPERIENCED_WARNINGS, "years": years}
    if years < FRESHER_BELOW_YEARS:
        return {"experience_level": "fresher", "max_warnings": FRESHER_WARNINGS, "years": years}
    return {"experience_level": "mid", "max_warnings": DEFAULT_WARNINGS, "years": years}
