import { BotInterviewAttemptClient } from "./BotInterviewAttemptClient";

export default async function BotInterviewAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BotInterviewAttemptClient interviewId={id} />;
}
