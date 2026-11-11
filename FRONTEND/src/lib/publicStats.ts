const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";

export type PublicStats = {
  organizations_count: number;
  candidates_count: number;
  interviews_completed_count: number;
  jobs_posted_count: number;
};

export async function getPublicStats(): Promise<PublicStats> {
  const res = await fetch(`${API_URL}/public/stats`);
  if (!res.ok) {
    throw new Error("Could not load platform stats.");
  }
  return res.json();
}
