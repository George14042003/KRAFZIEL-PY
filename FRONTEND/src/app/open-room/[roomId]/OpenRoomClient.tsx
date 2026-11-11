"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./OpenRoom.module.css";

type Status = "idle" | "starting" | "waiting" | "connecting" | "connected" | "ended" | "error";

const TEXT: Record<Status, string> = {
  idle: "Ready to join",
  starting: "Starting camera and microphone…",
  waiting: "Waiting for the other person to join…",
  connecting: "Connecting…",
  connected: "Connected",
  ended: "Call ended",
  error: "Could not join",
};

const REASONS: Record<string, string> = {
  "room-full": "This room already has two people in it.",
  "already-connected": "This link is already open in another window.",
  "room-closed": "The host ended this room.",
};

export function OpenRoomClient({ roomId }: { roomId: string }) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingRef = useRef<RTCIceCandidateInit[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tokenRef = useRef("");

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [me, setMe] = useState<{ name: string; role: string } | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [record, setRecord] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);

  useEffect(() => {
    tokenRef.current = new URLSearchParams(window.location.search).get("token") ?? "";
    if (!tokenRef.current) {
      setStatus("error");
      setError("This link is missing its token. Ask for a fresh link.");
    }
  }, []);

  const fail = useCallback((message: string) => {
    setError(message);
    setStatus("error");
  }, []);

  const stopRecording = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    recorderRef.current = null;
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];
    if (blob.size === 0) return;
    const form = new FormData();
    form.append("file", blob, "recording.webm");
    try {
      const res = await fetch(`/open/v1/rooms/${roomId}/recordings?token=${encodeURIComponent(tokenRef.current)}`, { method: "POST", body: form });
      if (res.ok) setUploaded(((await res.json()) as { url: string }).url);
    } catch {}
  }, [roomId]);

  const leave = useCallback(async () => {
    await stopRecording();
    wsRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (remoteRef.current) remoteRef.current.srcObject = null;
    setStatus("ended");
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      pcRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function join() {
    setError(null);
    setStatus("starting");
    let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    try {
      const res = await fetch(`/open/v1/ice-servers?token=${encodeURIComponent(tokenRef.current)}`);
      if (res.status === 401 || res.status === 410) {
        const d = await res.json().catch(() => ({}));
        return fail(typeof d.detail === "string" ? d.detail : "This link is not valid.");
      }
      if (res.ok) iceServers = ((await res.json()) as { iceServers: RTCIceServer[] }).iceServers ?? iceServers;
    } catch {}

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      return fail("Camera and microphone access is needed to join. Allow it in your browser and try again.");
    }
    streamRef.current = stream;
    if (localRef.current) localRef.current.srcObject = stream;

    const makePc = (ws: WebSocket) => {
      const pc = new RTCPeerConnection({ iceServers });
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => e.candidate && ws.send(JSON.stringify({ type: "ice-candidate", candidate: e.candidate.toJSON() }));
      pc.ontrack = (e) => {
        if (remoteRef.current) {
          remoteRef.current.srcObject = e.streams[0];
          remoteRef.current.play().catch(() => {});
        }
        setStatus("connected");
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") fail("The connection could not be established. Check your network and try again.");
      };
      pcRef.current = pc;
      return pc;
    };
    const flush = async (pc: RTCPeerConnection) => {
      for (const c of pendingRef.current) await pc.addIceCandidate(c);
      pendingRef.current = [];
    };

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/open/${roomId}?token=${encodeURIComponent(tokenRef.current)}`);
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "unauthorized":
          stream.getTracks().forEach((t) => t.stop());
          return fail(typeof msg.reason === "string" ? msg.reason : "This link is not valid.");
        case "room-full":
        case "already-connected":
        case "room-closed":
          stream.getTracks().forEach((t) => t.stop());
          return fail(REASONS[msg.type]);
        case "joined": {
          setMe({ name: msg.name, role: msg.role });
          setStatus("waiting");
          if (msg.initiator) {
            const pc = makePc(ws);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
          }
          return;
        }
        case "peer-joined":
          setPeerName(msg.name ?? null);
          return setStatus("connecting");
        case "offer": {
          const pc = pcRef.current ?? makePc(ws);
          await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
          await flush(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
          return;
        }
        case "answer": {
          const pc = pcRef.current;
          if (pc) {
            await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
            await flush(pc);
          }
          return;
        }
        case "ice-candidate": {
          const pc = pcRef.current;
          if (pc?.remoteDescription) await pc.addIceCandidate(msg.candidate);
          else pendingRef.current.push(msg.candidate);
          return;
        }
        case "peer-left":
          if (pcRef.current?.connectionState === "connected") return;
          if (remoteRef.current) remoteRef.current.srcObject = null;
          return setStatus("ended");
      }
    };
    ws.onclose = () => setStatus((s) => (s === "connected" || s === "waiting" || s === "connecting" ? "ended" : s));

    if (record && typeof MediaRecorder !== "undefined") {
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.start(5000);
      recorderRef.current = rec;
    }
  }

  function toggle(kind: "audio" | "video") {
    const tracks = kind === "audio" ? streamRef.current?.getAudioTracks() : streamRef.current?.getVideoTracks();
    const next = !(kind === "audio" ? micOn : camOn);
    tracks?.forEach((t) => (t.enabled = next));
    (kind === "audio" ? setMicOn : setCamOn)(next);
  }

  const live = status === "waiting" || status === "connecting" || status === "connected";

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <span className={styles.brand}>Krafziel</span>
        <span className={`${styles.badge} ${status === "connected" ? styles.badgeOn : ""}`}>{TEXT[status]}</span>
      </header>

      <main className={styles.stage}>
        <div className={styles.videos}>
          <div className={styles.remote}>
            <video ref={remoteRef} autoPlay playsInline />
            {status !== "connected" && <div className={styles.placeholder}>{status === "ended" ? "Call ended" : peerName ? `Connecting to ${peerName}…` : "Waiting for the other person"}</div>}
            {status === "connected" && peerName && <span className={styles.tag}>{peerName}</span>}
          </div>
          <div className={styles.local}>
            <video ref={localRef} autoPlay playsInline muted />
            {me && <span className={styles.tag}>{me.name} (you)</span>}
          </div>
        </div>

        {!live && status !== "ended" && (
          <div className={styles.join}>
            <h1>Join the video room</h1>
            <p>Your camera and microphone are used only for this call.</p>
            <label className={styles.check}>
              <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} /> Record my side and upload it when I leave
            </label>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button type="button" className={styles.primary} disabled={status === "starting"} onClick={join}>
              {status === "starting" ? "Starting…" : "Join call"}
            </button>
          </div>
        )}

        {status === "ended" && (
          <div className={styles.join}>
            <h1>Call ended</h1>
            {uploaded && <p>Your recording was uploaded.</p>}
            <p>You can close this tab.</p>
          </div>
        )}

        {live && (
          <div className={styles.controls}>
            <button type="button" onClick={() => toggle("audio")} className={micOn ? "" : styles.off}>
              {micOn ? "Mute" : "Unmute"}
            </button>
            <button type="button" onClick={() => toggle("video")} className={camOn ? "" : styles.off}>
              {camOn ? "Camera off" : "Camera on"}
            </button>
            <button type="button" onClick={leave} className={styles.leave}>
              Leave
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
