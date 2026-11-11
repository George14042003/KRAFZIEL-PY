import { getStoredToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";

export type MockType = "mixed" | "behavioral" | "hr" | "technical";
export type MockDifficulty = "easy" | "medium" | "hard";

export type MockOptions = {
  interview_types: { key: MockType; label: string; blurb: string }[];
  fields: { key: string; label: string; blurb: string }[];
  difficulties: { key: MockDifficulty; label: string }[];
  max_questions: number;
  ai_enabled: boolean;
};

export type MockQuestion = { id: number; text: string; tip: string; focus: string };

export type MockFeedback = {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  model_answer: string | null;
  star: { situation: boolean; task: boolean; action: boolean; result: boolean };
  tags: string[];
  metrics: { word_count: number; filler_words: number; numbers: number; hedges: number; i_count: number; we_count: number };
  ai: boolean;
};

export type MockSummary = {
  average: number;
  readiness: string;
  best_question: string;
  weakest_question: string;
  strengths: string[];
  focus_areas: string[];
  next_steps: string[];
};

export type MockSetup = { interview_type: MockType; field: string | null; role: string; difficulty: MockDifficulty; count: number };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (HTTP ${res.status}).`);
  }
  return res.json() as Promise<T>;
}

export const getMockOptions = () => request<MockOptions>("/mock-interviews/options");

export const startMock = (setup: MockSetup) =>
  request<{ questions: MockQuestion[]; source: "ai" | "bank" | "mixed" }>("/mock-interviews/start", {
    method: "POST",
    body: JSON.stringify({ ...setup, role: setup.role.trim() || null }),
  });

export const evaluateMock = (setup: MockSetup, question: string, answer: string) =>
  request<MockFeedback>("/mock-interviews/evaluate", {
    method: "POST",
    body: JSON.stringify({
      question,
      answer,
      interview_type: setup.interview_type,
      field: setup.field,
      role: setup.role.trim() || null,
      difficulty: setup.difficulty,
    }),
  });

export const summariseMock = (results: { question: string; score: number; tags: string[] }[]) =>
  request<MockSummary>("/mock-interviews/summary", { method: "POST", body: JSON.stringify({ results }) });

// ---------- Practice history (kept in this browser only) ----------

export type MockRound = {
  question: MockQuestion;
  answer: string;
  feedback: MockFeedback;
};

export type MockSession = {
  id: string;
  at: string;
  setup: MockSetup;
  rounds: MockRound[];
  summary: MockSummary;
};

const HISTORY_KEY = "naie-mock-history-v1";
const MAX_SESSIONS = 20;

export function loadHistory(userId: string): MockSession[] {
  try {
    const raw = window.localStorage.getItem(`${HISTORY_KEY}:${userId}`);
    const parsed = raw ? (JSON.parse(raw) as MockSession[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSession(userId: string, session: MockSession): MockSession[] {
  const next = [session, ...loadHistory(userId)].slice(0, MAX_SESSIONS);
  try {
    window.localStorage.setItem(`${HISTORY_KEY}:${userId}`, JSON.stringify(next));
  } catch {
    // storage full or blocked: practising still works, history just isn't kept
  }
  return next;
}

export function clearHistory(userId: string): void {
  try {
    window.localStorage.removeItem(`${HISTORY_KEY}:${userId}`);
  } catch {
    // ignore
  }
}
