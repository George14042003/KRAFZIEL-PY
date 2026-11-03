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
  experience_min_years: number | null;
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
  experience_min_years?: number | null;
};

export type ResumeData = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: { label: string; url: string }[];
  summary: string;
  total_experience_years: number | null;
  skills: string[];
  experience: { title: string; company: string; period: string; highlights: string[] }[];
  education: { degree: string; institution: string; period: string }[];
  projects: { name: string; description: string; tech: string }[];
  certifications: string[];
  source: "ai" | "basic";
  filename: string;
};

export type PortfolioData = {
  url: string;
  final_url?: string;
  status: "ok" | "unreachable" | "unsupported" | "blocked";
  error?: string;
  title: string;
  description: string;
  summary: string;
  highlights: string[];
  technologies: string[];
  embeddable: boolean;
  fetched_at: string;
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
  resume_filename: string | null;
  resume_data: ResumeData | null;
  portfolio_url: string | null;
  portfolio_data: PortfolioData | null;
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
  experience_min_years: number | null;
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
  experience_min_years?: number | null;
};

export type MyApplication = {
  id: string;
  status: JobApplicationStatus;
  cover_letter: string | null;
  resume_filename?: string | null;
  portfolio_url?: string | null;
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

export type ApplyWithResumeInput = {
  resume: File;
  portfolio_url?: string;
  phone?: string;
  cover_letter?: string;
};

/** Apply with a Word resume (.doc / .docx) and an optional portfolio link. */
export async function applyWithResume(jobId: string, input: ApplyWithResumeInput): Promise<JobApplication> {
  const form = new FormData();
  form.append("resume", input.resume, input.resume.name);
  if (input.portfolio_url?.trim()) form.append("portfolio_url", input.portfolio_url.trim());
  if (input.phone?.trim()) form.append("phone", input.phone.trim());
  if (input.cover_letter?.trim()) form.append("cover_letter", input.cover_letter.trim());
  const res = await fetch(`${API_URL}/jobs/${jobId}/apply/form`, { method: "POST", headers: authHeaders(), body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "Could not submit your application. Please check the file and try again.");
  }
  return res.json();
}

/** "Fresher friendly" or "5+ years experience", for a job's experience requirement. */
export function experienceLabel(years: number | null | undefined): string | null {
  if (years === null || years === undefined) return null;
  return years <= 0 ? "Fresher friendly" : `${years}+ years experience`;
}

export function listMyApplications(): Promise<MyApplication[]> {
  return request("/jobs/mine");
}

export function withdrawApplication(id: string): Promise<MyApplication> {
  return request(`/jobs/mine/${id}/withdraw`, { method: "PATCH" });
}
