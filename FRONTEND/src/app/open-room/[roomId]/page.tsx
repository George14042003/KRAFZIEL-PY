import type { Metadata } from "next";
import { OpenRoomClient } from "./OpenRoomClient";

export const metadata: Metadata = {
  title: "Video room | Elzuron",
  robots: { index: false },
};

export default async function OpenRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <OpenRoomClient roomId={roomId} />;
}
