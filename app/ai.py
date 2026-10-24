import io
import json
import os
from typing import Optional

import httpx

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
QUESTIONS_MODEL = os.environ.get("OPENAI_QUESTIONS_MODEL", "gpt-4o-mini")
EVALUATION_MODEL = os.environ.get("OPENAI_EVALUATION_MODEL", "gpt-4o-mini")
NUM_QUESTIONS = 5
RESUME_TEXT_CHAR_LIMIT = 6000

DEFAULT_QUESTIONS = [
    "Tell us about yourself and what draws you to this role.",
    "Describe a challenging project you worked on. What was your role and the outcome?",
    "How do you handle tight deadlines or competing priorities?",
    "Tell us about a time you disagreed with a teammate or manager. How did you handle it?",
    "Where do you see yourself professionally over the next few years?",
]

_client = None


def _get_client():
    global _client
    if not OPENAI_API_KEY:
        return None
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def fetch_resume_text(resume_url: Optional[str]) -> Optional[str]:
    """Best-effort download + text extraction for a candidate's resume_url.
    resume_url is an arbitrary employer-typed link (Drive, Dropbox, direct file, etc.),
    so any failure here is expected and non-fatal — callers should fall back gracefully.
    """
    if not resume_url:
        return None
    try:
        resp = httpx.get(resume_url, timeout=10, follow_redirects=True)
        resp.raise_for_status()
    except (httpx.HTTPError, httpx.InvalidURL):
        return None

    content_type = resp.headers.get("content-type", "").lower()
    body = resp.content

    try:
        if "pdf" in content_type or resume_url.lower().endswith(".pdf"):
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(body))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        elif "wordprocessingml" in content_type or resume_url.lower().endswith(".docx"):
            from docx import Document

            doc = Document(io.BytesIO(body))
            text = "\n".join(p.text for p in doc.paragraphs)
        elif "text/plain" in content_type or resume_url.lower().endswith(".txt"):
            text = body.decode("utf-8", errors="ignore")
        else:
            # Unknown type (often an HTML viewer page for a share link) — not reliably parseable.
            return None
    except Exception:
        return None

    text = text.strip()
    if not text:
        return None
    return text[:RESUME_TEXT_CHAR_LIMIT]


def generate_interview_questions(
    candidate_name: str,
    job_title: Optional[str],
    job_description: Optional[str],
    resume_text: Optional[str],
) -> list[str]:
    client = _get_client()
    if client is None:
        return DEFAULT_QUESTIONS

    context_parts = [f"Candidate name: {candidate_name}"]
    if job_title:
        context_parts.append(f"Role they applied for: {job_title}")
    if job_description:
        context_parts.append(f"Role description: {job_description[:1500]}")
    if resume_text:
        context_parts.append(f"Candidate resume excerpt:\n{resume_text}")
    else:
        context_parts.append("No resume is available for this candidate.")
    context = "\n\n".join(context_parts)

    prompt = (
        f"You are designing an async text-based screening interview. Based on the context below, "
        f"write exactly {NUM_QUESTIONS} open-ended interview questions that evaluate the candidate's "
        f"soft skills (communication, problem-solving, collaboration, adaptability) and relevance to the role. "
        f"Keep each question concise (under 30 words), avoid yes/no questions, and do not repeat topics.\n\n"
        f"{context}\n\n"
        f'Respond with strict JSON: {{"questions": ["...", "...", "...", "...", "..."]}}'
    )

    try:
        resp = client.chat.completions.create(
            model=QUESTIONS_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        data = json.loads(resp.choices[0].message.content)
        questions = [q.strip() for q in data.get("questions", []) if isinstance(q, str) and q.strip()]
        if len(questions) >= 3:
            return questions[:NUM_QUESTIONS]
    except Exception as exc:
        print(f"[ai] Failed to generate interview questions: {exc}")

    return DEFAULT_QUESTIONS


def evaluate_soft_skills(
    qa_pairs: list[dict],
    mode: str = "text",
    speaking_metrics: Optional[list[dict]] = None,
) -> Optional[dict]:
    """qa_pairs: list of {"question": str, "answer": str}.
    mode: "text" or "voice" — voice mode adds a confidence dimension informed by speaking_metrics.
    speaking_metrics (voice mode only): list of {"duration_seconds": float, "word_count": int,
        "filler_word_count": int} aligned index-for-index with qa_pairs, describing how each
        answer was delivered (derived from browser speech-recognition timing, not audio prosody).
    Returns a structured evaluation dict, or None on failure.
    """
    client = _get_client()
    if client is None or not qa_pairs:
        return None

    transcript_parts = []
    for i, pair in enumerate(qa_pairs):
        entry = f"Q: {pair['question']}\nA: {pair['answer']}"
        if mode == "voice" and speaking_metrics and i < len(speaking_metrics):
            m = speaking_metrics[i]
            entry += (
                f"\n[delivery: {m.get('word_count', '?')} words spoken over "
                f"{m.get('duration_seconds', '?')}s, {m.get('filler_word_count', 0)} filler words "
                f'(e.g. "um", "uh", "like")]'
            )
        transcript_parts.append(entry)
    transcript = "\n\n".join(transcript_parts)

    dimensions = '"communication": <int 1-10>, "problem_solving": <int 1-10>, ' '"culture_fit": <int 1-10>, "keyword_relevance": <int 1-10>'
    if mode == "voice":
        dimensions += ', "confidence": <int 1-10>'
    dimensions += ', "overall": <int 1-10>, "summary": "<string>"'

    keyword_note = (
        "keyword_relevance: how well each answer covers the specific concepts, terminology, or "
        "substance the question was actually asking for (not just fluent writing)."
    )
    confidence_note = (
        "\nconfidence: infer speaking confidence from delivery metadata (filler word density, "
        "words-per-minute pace, answer length relative to duration) and from decisive vs hedging "
        "language in the transcript itself (e.g. \"I think maybe...\" vs \"I did X because Y\"). "
        "This is a linguistic/pacing proxy, not acoustic voice analysis."
        if mode == "voice"
        else ""
    )

    prompt = (
        f"You are an HR interview evaluator. Based on the Q&A transcript below from an async "
        f"{'voice' if mode == 'voice' else 'text'} interview, evaluate the candidate's soft skills. "
        f"Score each dimension from 1-10 (integers) and give a short (2-3 sentence) overall summary "
        f"highlighting strengths and concerns.\n\n{keyword_note}{confidence_note}\n\n"
        f"{transcript}\n\n"
        f"Respond with strict JSON: {{{dimensions}}}"
    )

    try:
        resp = client.chat.completions.create(
            model=EVALUATION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        data = json.loads(resp.choices[0].message.content)
        required = {"communication", "problem_solving", "culture_fit", "keyword_relevance", "overall", "summary"}
        if mode == "voice":
            required.add("confidence")
        if required.issubset(data.keys()):
            return data
    except Exception as exc:
        print(f"[ai] Failed to evaluate soft skills: {exc}")

    return None


def evaluate_call_transcript(turns: list[dict]) -> Optional[dict]:
    """turns: list of {"speaker": "candidate" | "employer", "text": str}, in speaking order,
    accumulated client-side from live-call captions (browser speech recognition).
    Returns the same shape as evaluate_soft_skills's voice mode (adds "confidence"), so it
    drops into Interview.ai_evaluation and the existing scorecard rendering unchanged.
    """
    client = _get_client()
    if client is None or not turns:
        return None

    transcript = "\n".join(f"{t['speaker'].capitalize()}: {t['text']}" for t in turns)

    dimensions = (
        '"communication": <int 1-10>, "problem_solving": <int 1-10>, '
        '"culture_fit": <int 1-10>, "keyword_relevance": <int 1-10>, '
        '"confidence": <int 1-10>, "overall": <int 1-10>, "summary": "<string>"'
    )

    prompt = (
        "You are an HR interview evaluator. Below is a live-transcribed conversation between an "
        "employer and a candidate during a real-time video interview. Evaluate the candidate's "
        "soft skills based only on the candidate's contributions, using the employer's turns as "
        "context for what was being asked. Score each dimension from 1-10 (integers) and give a "
        "short (2-3 sentence) overall summary highlighting strengths and concerns.\n\n"
        "keyword_relevance: how well the candidate's answers cover the specific concepts, "
        "terminology, or substance the employer's questions were actually asking for.\n"
        "confidence: infer speaking confidence from decisive vs hedging language in the "
        'transcript (e.g. "I think maybe..." vs "I did X because Y"). This is a linguistic proxy, '
        "not acoustic voice analysis — the transcript may also contain minor speech-recognition "
        "errors, which you should look past.\n\n"
        f"{transcript}\n\n"
        f"Respond with strict JSON: {{{dimensions}}}"
    )

    try:
        resp = client.chat.completions.create(
            model=EVALUATION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        data = json.loads(resp.choices[0].message.content)
        required = {
            "communication",
            "problem_solving",
            "culture_fit",
            "keyword_relevance",
            "confidence",
            "overall",
            "summary",
        }
        if required.issubset(data.keys()):
            return data
    except Exception as exc:
        print(f"[ai] Failed to evaluate call transcript: {exc}")

    return None
