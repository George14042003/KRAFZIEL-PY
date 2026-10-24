import { getStoredToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";

export type CandidateStatus =
  | "pending"
  | "reviewed"
  | "interviewing"
  | "offered"
  | "hired"
  | "rejected";
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";
export type InterviewType = "phone" | "video" | "onsite" | "technical" | "final" | "bot";
export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "rescheduled" | "no_show";
export type AvailabilityStatus = "pending" | "accepted" | "declined";

export type Candidate = {
  id: string;
  applicant_name: string;
  applicant_email: string;
  phone: string | null;
  source: string | null;
  resume_url: string | null;
  notes: string | null;
  status: CandidateStatus;
  created_at: string;
  updated_at: string;
  interview_count: number;
  offer_count: number;
  created_by_name: string | null;
  created_by_email: string | null;
};

export type AiEvaluation = {
  communication: number;
  problem_solving: number;
  culture_fit: number;
  keyword_relevance: number;
  confidence?: number;
  overall: number;
  summary: string;
};

export type Interview = {
  id: string;
  candidate_id: string;
  scheduled_at: string;
  duration_minutes: number;
  interview_type: InterviewType;
  status: InterviewStatus;
  interviewer_name: string;
  interviewer_email: string | null;
  location_or_link: string | null;
  notes: string | null;
  questions: string[] | null;
  ai_evaluation: AiEvaluation | null;
  recording_urls: string[] | null;
  availability_status: AvailabilityStatus;
  consent_accepted: boolean;
  consent_given_at: string | null;
  identity_snapshot_url: string | null;
  employer_feedback: string | null;
  employer_rating: number | null;
  created_at: string;
  updated_at: string;
};

export type Offer = {
  id: string;
  candidate_id: string;
  salary: number;
  currency: string;
  start_date: string | null;
  expires_at: string | null;
  status: OfferStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Request failed.");
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export type CandidatePayload = {
  applicant_name: string;
  applicant_email: string;
  phone?: string;
  source?: string;
  resume_url?: string;
  notes?: string;
  status?: CandidateStatus;
};

export function listCandidates(): Promise<Candidate[]> {
  return request("/candidates");
}

export function getCandidate(id: string): Promise<Candidate> {
  return request(`/candidates/${id}`);
}

export function createCandidate(payload: CandidatePayload): Promise<Candidate> {
  return request("/candidates", { method: "POST", body: JSON.stringify(payload) });
}

export function updateCandidate(id: string, payload: Partial<CandidatePayload>): Promise<Candidate> {
  return request(`/candidates/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteCandidate(id: string): Promise<void> {
  return request(`/candidates/${id}`, { method: "DELETE" });
}

export type InterviewPayload = {
  scheduled_at: string;
  duration_minutes?: number;
  interview_type: InterviewType;
  status?: InterviewStatus;
  interviewer_name: string;
  interviewer_email?: string;
  location_or_link?: string;
  notes?: string;
  employer_feedback?: string;
  employer_rating?: number;
};

export function listInterviewsForCandidate(candidateId: string): Promise<Interview[]> {
  return request(`/candidates/${candidateId}/interviews`);
}

export function listAllInterviews(): Promise<Interview[]> {
  return request("/interviews");
}

export function createInterview(candidateId: string, payload: InterviewPayload): Promise<Interview> {
  return request(`/candidates/${candidateId}/interviews`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateInterview(id: string, payload: Partial<InterviewPayload>): Promise<Interview> {
  return request(`/interviews/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteInterview(id: string): Promise<void> {
  return request(`/interviews/${id}`, { method: "DELETE" });
}

export type OfferPayload = {
  salary: number;
  currency?: string;
  start_date?: string | null;
  expires_at?: string | null;
  status?: OfferStatus;
  notes?: string | null;
};

export function listOffersForCandidate(candidateId: string): Promise<Offer[]> {
  return request(`/candidates/${candidateId}/offers`);
}

export function listAllOffers(): Promise<Offer[]> {
  return request("/offers");
}

export function createOffer(candidateId: string, payload: OfferPayload): Promise<Offer> {
  return request(`/candidates/${candidateId}/offers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateOffer(id: string, payload: Partial<OfferPayload>): Promise<Offer> {
  return request(`/offers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteOffer(id: string): Promise<void> {
  return request(`/offers/${id}`, { method: "DELETE" });
}

export type PortalInterview = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  interview_type: InterviewType;
  status: InterviewStatus;
  interviewer_name: string;
  location_or_link: string | null;
  ai_evaluation: AiEvaluation | null;
};

export type PortalOffer = {
  id: string;
  salary: number;
  currency: string;
  start_date: string | null;
  expires_at: string | null;
  status: OfferStatus;
};

export type PortalCandidate = {
  id: string;
  applicant_name: string;
  applicant_email: string;
  phone: string | null;
  source: string | null;
  status: CandidateStatus;
  created_at: string;
  interviews: PortalInterview[];
  offers: PortalOffer[];
};

export function getMyPortal(): Promise<{ candidate: PortalCandidate | null }> {
  return request("/me/portal");
}

export type InterviewAttempt = {
  candidate_name: string;
  interview_type: InterviewType;
  status: InterviewStatus;
  scheduled_at: string;
  duration_minutes: number;
  questions: string[];
  availability_status: AvailabilityStatus;
  consent_accepted: boolean;
};

export type InterviewAnswer = { question: string; answer: string };

export type SpeakingMetric = { duration_seconds: number; word_count: number; filler_word_count: number };

export function getInterviewAttempt(interviewId: string): Promise<InterviewAttempt> {
  return request(`/interviews/${interviewId}/attempt`);
}

export function submitInterviewAttempt(
  interviewId: string,
  answers: InterviewAnswer[],
  durationMinutes?: number,
  mode: "text" | "voice" = "text",
  speakingMetrics?: SpeakingMetric[]
): Promise<InterviewAttempt> {
  return request(`/interviews/${interviewId}/attempt`, {
    method: "POST",
    body: JSON.stringify({
      answers,
      duration_minutes: durationMinutes,
      mode,
      speaking_metrics: speakingMetrics,
    }),
  });
}

export function terminateInterviewAttempt(
  interviewId: string,
  reason: string,
  answers: InterviewAnswer[] = []
): Promise<InterviewAttempt> {
  return request(`/interviews/${interviewId}/terminate`, {
    method: "POST",
    body: JSON.stringify({ reason, answers }),
  });
}

export type InterviewHeartbeat = { status: InterviewStatus; terminated: boolean };

export function sendInterviewHeartbeat(interviewId: string): Promise<InterviewHeartbeat> {
  return request(`/interviews/${interviewId}/heartbeat`, { method: "POST" });
}

export type AvailabilityInfo = {
  candidate_name: string;
  interview_type: InterviewType;
  scheduled_at: string;
  duration_minutes: number;
  interviewer_name: string;
  availability_status: AvailabilityStatus;
};

export function getInterviewAvailability(interviewId: string): Promise<AvailabilityInfo> {
  return request(`/interviews/${interviewId}/availability`);
}

export function acceptInterviewAvailability(interviewId: string): Promise<AvailabilityInfo> {
  return request(`/interviews/${interviewId}/availability/accept`, { method: "POST" });
}

export function declineInterviewAvailability(interviewId: string): Promise<AvailabilityInfo> {
  return request(`/interviews/${interviewId}/availability/decline`, { method: "POST" });
}

export type ConsentPayload = {
  recording_and_ai_evaluation: boolean;
  proctoring_and_identity_snapshot: boolean;
  data_storage_and_retention: boolean;
};

export function submitInterviewConsent(interviewId: string, payload: ConsentPayload): Promise<Interview> {
  return request(`/interviews/${interviewId}/consent`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadIdentitySnapshot(interviewId: string, blob: Blob): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", blob, "snapshot.jpg");
  const res = await fetch(`${API_URL}/interviews/${interviewId}/identity-snapshot`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error("Could not upload identity snapshot.");
  }
  return res.json();
}
