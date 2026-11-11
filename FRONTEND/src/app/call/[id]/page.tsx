import { CallRoomClient } from "./CallRoomClient";

export default async function CallRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CallRoomClient roomId={id} />;
}
