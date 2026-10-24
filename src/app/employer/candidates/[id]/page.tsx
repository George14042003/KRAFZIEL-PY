import { CandidateDetailClient } from "./CandidateDetailClient";

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CandidateDetailClient candidateId={id} />;
}
