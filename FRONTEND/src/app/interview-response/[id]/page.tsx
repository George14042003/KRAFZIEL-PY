import { InterviewResponseClient } from "./InterviewResponseClient";

export default async function InterviewResponsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InterviewResponseClient interviewId={id} />;
}
