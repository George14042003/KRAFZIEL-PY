import { JobDetailClient } from "./JobDetailClient";

export default async function EmployerJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetailClient jobId={id} />;
}
