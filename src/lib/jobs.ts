import { getStoredToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";

export type EmploymentType = "full_time" | "part_time" | "contract" | "internship";
export type JobStatus = "draft" | "open" | "closed" | "filled";
export type JobApplicationStatus =
  | "submitted"
  | "under_review"
  | "shortlisted"
  | "interviewing"
  | "offered"
  | "hired"
  | "rejected"
  | "withdrawn";

export type Job = {
  id: string;
  title: string;
  description: string;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType;
  status: JobStatus;
  salary_min: number | null;
  salary_max: number | null;
  application_count: number;
  created_by_name: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type JobPayload = {
  title: string;
  description: string;
  department?: string;
  location?: string;
  employment_type?: EmploymentType;
  status?: JobStatus;
  salary_min?: number | null;
  salary_max?: number | null;
};

export type CandidateSummary = {
  id: string;
  applicant_name: string;
  applicant_email: string;
  phone: string | null;
  resume_url: string | null;
  source: string | null;
  status: string;
};

export type JobApplication = {
  id: string;
  job_id: string;
  job_title: string;
  status: JobApplicationStatus;
  cover_letter: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  candidate: CandidateSummary;
};

export type JobApplicationUpdatePayload = {
  status?: JobApplicationStatus;
  notes?: string;
};

export type JobBoardListing = {
  id: string;
  title: string;
  description: string;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType;
  salary_min: number | null;
  salary_max: number | null;
  created_at: string;
  already_applied: boolean;
  my_application_status: JobApplicationStatus | null;
};

export type ApplyPayload = {
  resume_url?: string;
  phone?: string;
  cover_letter?: string;
};

export type JobSummary = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType;
  status: JobStatus;
  salary_min: number | null;
  salary_max: number | null;
};

export type MyApplication = {
  id: string;
  status: JobApplicationStatus;
  cover_letter: string | null;
  created_at: string;
  updated_at: string;
  job: JobSummary;
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

// --- Employer: job CRUD ---

export function listJobs(): Promise<Job[]> {
  return request("/jobs");
}

export function getJob(id: string): Promise<Job> {
  return request(`/jobs/${id}`);
}

export function createJob(payload: JobPayload): Promise<Job> {
  return request("/jobs", { method: "POST", body: JSON.stringify(payload) });
}

export function updateJob(id: string, payload: Partial<JobPayload>): Promise<Job> {
  return request(`/jobs/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteJob(id: string): Promise<void> {
  return request(`/jobs/${id}`, { method: "DELETE" });
}

// --- Employer: applicant management ---

export function listApplicationsForJob(jobId: string): Promise<JobApplication[]> {
  return request(`/jobs/${jobId}/applications`);
}

export function linkCandidateToJob(jobId: string, candidateId: string): Promise<JobApplication> {
  return request(`/jobs/${jobId}/applications`, {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId }),
  });
}

export function listAllApplications(): Promise<JobApplication[]> {
  return request("/job-applications");
}

export function getApplication(id: string): Promise<JobApplication> {
  return request(`/job-applications/${id}`);
}

export function updateApplication(
  id: string,
  payload: JobApplicationUpdatePayload
): Promise<JobApplication> {
  return request(`/job-applications/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

// --- Candidate: job board + my applications ---

export function listOpenJobs(): Promise<JobBoardListing[]> {
  return request("/jobs/board");
}

export function applyToJob(jobId: string, payload: ApplyPayload): Promise<JobApplication> {
  return request(`/jobs/${jobId}/apply`, { method: "POST", body: JSON.stringify(payload) });
}

export function listMyApplications(): Promise<MyApplication[]> {
  return request("/jobs/mine");
}

export function withdrawApplication(id: string): Promise<MyApplication> {
  return request(`/jobs/mine/${id}/withdraw`, { method: "PATCH" });
}
