"""Mock (practice) interviews for candidates. Stateless: nothing is stored here, so practising never touches
real interview data, plan limits or an employer's account. The browser keeps the candidate's practice history."""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app import mock_coach
from app.mock_bank import CATEGORIES
from app.security import require_candidate
from app import models

router = APIRouter(prefix="/mock-interviews", tags=["mock-interviews"])

InterviewTypeKey = Literal["mixed", "behavioral", "hr", "technical"]
DifficultyKey = Literal["easy", "medium", "hard"]


class StartRequest(BaseModel):
    interview_type: InterviewTypeKey = "mixed"
    field: Optional[str] = Field(default=None, max_length=40)
    role: Optional[str] = Field(default=None, max_length=80)
    difficulty: DifficultyKey = "medium"
    count: int = Field(default=5, ge=1, le=mock_coach.MAX_QUESTIONS)


class EvaluateRequest(BaseModel):
    question: str = Field(min_length=3, max_length=400)
    answer: str = Field(min_length=1, max_length=mock_coach.MAX_ANSWER_CHARS)
    interview_type: InterviewTypeKey = "mixed"
    field: Optional[str] = Field(default=None, max_length=40)
    role: Optional[str] = Field(default=None, max_length=80)
    difficulty: DifficultyKey = "medium"


class SummaryItem(BaseModel):
    question: str = Field(max_length=400)
    score: int = Field(ge=1, le=10)
    tags: list[str] = Field(default_factory=list, max_length=12)


class SummaryRequest(BaseModel):
    results: list[SummaryItem] = Field(min_length=1, max_length=mock_coach.MAX_QUESTIONS)


@router.get("/options")
def get_options(_user: models.User = Depends(require_candidate)):
    return mock_coach.options()


@router.post("/start")
def start_session(payload: StartRequest, _user: models.User = Depends(require_candidate)):
    if payload.field is not None and payload.field not in CATEGORIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown role area.")
    return mock_coach.build_questions(payload.interview_type, payload.field, (payload.role or "").strip() or None, payload.difficulty, payload.count)


@router.post("/evaluate")
def evaluate(payload: EvaluateRequest, _user: models.User = Depends(require_candidate)):
    if payload.field is not None and payload.field not in CATEGORIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown role area.")
    if not payload.answer.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Write or speak an answer first.")
    return mock_coach.evaluate_answer(
        payload.question, payload.answer, payload.interview_type, payload.field, (payload.role or "").strip() or None, payload.difficulty
    )


@router.post("/summary")
def summary(payload: SummaryRequest, _user: models.User = Depends(require_candidate)):
    return mock_coach.summarise([r.model_dump() for r in payload.results])
