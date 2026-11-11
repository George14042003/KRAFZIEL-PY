"use client";

import { useEffect, useRef, useState } from "react";
import { ConsentGate } from "@/components/interview/ConsentGate";
import styles from "./CallRoom.module.css";
import { BrandLogo } from "@/components/BrandLogo";
import { captureVideoFrame } from "@/lib/captureSnapshot";
import { getStoredToken, requireSessionOrRedirect } from "@/lib/auth";
import { isOpenEdition } from "@/lib/edition";
import { submitInterviewConsent, updateInterview, uploadIdentitySnapshot } from "@/lib/candidates";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";

function authHeader(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
const WS_URL = API_URL.replace(/^http/, "ws");
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const DISCONNECT_GRACE_MS = 6000;
// Below this, an accumulated caption transcript is too thin to bother
// evaluating — mirrors MIN_TRANSCRIPT_TURNS on the backend.
const MIN_TRANSCRIPT_TURNS = 4;

type TranscriptTurn = { speaker: "candidate" | "employer"; text: string };
type ConnectionQuality = "good" | "fair" | "poor";

type SignalMessage =
  | { type: "joined"; initiator: boolean; role: "candidate" | "employer" }
  | { type: "peer-joined" }
  | { type: "peer-left" }
  | { type: "room-full" }
  | { type: "unauthorized" }
  | { type: "role-taken" }
  | { type: "not-confirmed" }
  | { type: "consent-required" }
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "chat"; text: string; at: string }
  | { type: "caption"; text: string; final: boolean };

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: { [i: number]: { [j: number]: { transcript: string }; isFinal: boolean }; length: number };
};

const CAPTION_FADE_MS = 4000;

type ChatMessage = {
  text: string;
  at: string;
  mine: boolean;
};

type CallStatus =
  | "checking-access"
  | "consent"
  | "requesting-media"
  | "media-denied"
  | "waiting"
  | "connecting"
  | "connected"
  | "ended";

const STATUS_TEXT: Record<CallStatus, string> = {
  "checking-access": "Checking access…",
  consent: "Waiting for consent…",
  "requesting-media": "Requesting camera and microphone…",
  "media-denied": "Camera/microphone access is required to join.",
  waiting: "Waiting for the other person to join…",
  connecting: "Connecting…",
  connected: "Connected",
  ended: "Call ended",
};

export function CallRoomClient({ roomId }: { roomId: string }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(FALLBACK_ICE_SERVERS);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const captioningOnRef = useRef(false);
  const myCaptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteCaptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const uploadedRef = useRef(false);
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});
  const stopCaptioningRef = useRef<() => void>(() => {});
  const startCaptioningRef = useRef<() => void>(() => {});
  const connectSignalingRef = useRef<() => void>(() => {});
  const myRoleRef = useRef<"candidate" | "employer" | null>(null);
  const snapshotTakenRef = useRef(false);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const evaluationSubmittedRef = useRef(false);
  const submitEvaluationRef = useRef<() => Promise<void>>(async () => {});
  const callStartRef = useRef<number | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<CallStatus>("checking-access");
  // Both sides join with their own login token: the candidate via a verified account
  // whose email matches the interview, the employer via their organization login.
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");
  const [captionsOn, setCaptionsOn] = useState(true);
  const [myCaption, setMyCaption] = useState("");
  const [remoteCaption, setRemoteCaption] = useState("");
  const [recording, setRecording] = useState(false);
  const [myRole, setMyRole] = useState<"candidate" | "employer" | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackNeedsLogin, setFeedbackNeedsLogin] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatOpenRef = useRef(false);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnreadChat(0);
  }, [chatOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    let cancelled = false;

    async function logSelectedCandidate(pc: RTCPeerConnection) {
      try {
        const stats = await pc.getStats();
        stats.forEach((r) => {
          if (r.type === "candidate-pair" && r.state === "succeeded" && (r.selected ?? true)) {
            const local = stats.get(r.localCandidateId);
            const remote = stats.get(r.remoteCandidateId);
            const path = `local=${local?.candidateType ?? "?"} remote=${remote?.candidateType ?? "?"}`;
            console.log("[call] selected candidate pair:", path, r);
            setDebugInfo((d) => `${d} | path: ${path}`);
          }
        });
      } catch (err) {
        console.warn("[call] getStats failed", err);
      }
    }

    function createPeerConnection(ws: WebSocket) {
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
      pc.oniceconnectionstatechange = () => {
        console.log("[call] iceConnectionState:", pc.iceConnectionState);
        setDebugInfo(`ice=${pc.iceConnectionState} conn=${pc.connectionState}`);
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          logSelectedCandidate(pc);
        }
      };
      pc.onicegatheringstatechange = () => {
        console.log("[call] iceGatheringState:", pc.iceGatheringState);
      };
      pc.onicecandidateerror = (event) => {
        const e = event as RTCPeerConnectionIceErrorEvent;
        console.warn("[call] ICE candidate error:", e.errorCode, e.errorText, e.url);
      };
      pc.ontrack = (event) => {
        const video = remoteVideoRef.current;
        if (video) {
          video.srcObject = event.streams[0];
          // Browsers block autoplay of an unmuted <video> without prior user
          // activation on that element. Try to play unmuted first (the "join
          // call" click usually counts as activation); if that's rejected,
          // fall back to a muted autoplay + an "Unmute" button the candidate
          // can click, rather than silently rendering a black box.
          video.play().catch(() => {
            video.muted = true;
            setRemoteMuted(true);
            video.play().catch(() => {});
          });
        }
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        setStatus("connected");
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          ws.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate.toJSON() }));
        }
      };
      pc.onconnectionstatechange = () => {
        console.log("[call] connectionState:", pc.connectionState);
        setDebugInfo(`ice=${pc.iceConnectionState} conn=${pc.connectionState}`);
        if (pc.connectionState === "connected") {
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
          return;
        }
        // "disconnected" is often transient (brief network blip, NAT rebind)
        // and frequently self-recovers within a few seconds — don't tear the
        // call down immediately. Only declare it over if it hasn't recovered
        // after a grace period, or if the connection is already terminal.
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          if (disconnectTimerRef.current) return;
          const immediate = pc.connectionState !== "disconnected";
          disconnectTimerRef.current = setTimeout(
            () => {
              disconnectTimerRef.current = null;
              setStatus((s) => (s === "connected" ? "ended" : s));
            },
            immediate ? 0 : DISCONNECT_GRACE_MS
          );
        }
      };
      pcRef.current = pc;
      return pc;
    }

    async function flushPendingCandidates(pc: RTCPeerConnection) {
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(candidate);
      }
      pendingCandidatesRef.current = [];
    }

    function connectSignaling() {
      const ws = new WebSocket(`${WS_URL}/ws/call/${roomId}?token=${encodeURIComponent(authToken ?? "")}`);
      wsRef.current = ws;

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data) as SignalMessage;

        if (msg.type === "room-full") {
          setStatus("ended");
          setError("This call already has two people in it.");
          ws.close();
          return;
        }

        if (msg.type === "unauthorized") {
          setStatus("ended");
          setError("This interview isn't linked to your account. Log in with the email it was sent to.");
          ws.close();
          return;
        }

        if (msg.type === "role-taken") {
          setStatus("ended");
          setError(
            "Someone has already joined this interview with this account. If this isn't you, contact your recruiter."
          );
          ws.close();
          return;
        }

        if (msg.type === "not-confirmed") {
          setStatus("ended");
          setError(
            "You haven't confirmed your availability for this interview yet — check your email for the confirmation link."
          );
          ws.close();
          return;
        }

        if (msg.type === "consent-required") {
          setStatus("consent");
          ws.close();
          return;
        }

        if (msg.type === "joined") {
          myRoleRef.current = msg.role;
          setMyRole(msg.role);
          setStatus("waiting");
          if (msg.role === "candidate" && !snapshotTakenRef.current) {
            snapshotTakenRef.current = true;
            const video = localVideoRef.current;
            if (video) {
              captureVideoFrame(video)
                .then((blob) => (blob ? uploadIdentitySnapshot(roomId, blob) : null))
                .catch(() => {});
            }
          }
          if (msg.initiator) {
            const pc = createPeerConnection(ws);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
          }
          return;
        }

        if (msg.type === "peer-joined") {
          setStatus("connecting");
          return;
        }

        if (msg.type === "offer") {
          const pc = pcRef.current ?? createPeerConnection(ws);
          await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
          await flushPendingCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
          return;
        }

        if (msg.type === "answer") {
          const pc = pcRef.current;
          if (pc) {
            await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
            await flushPendingCandidates(pc);
          }
          return;
        }

        if (msg.type === "ice-candidate") {
          const pc = pcRef.current;
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(msg.candidate);
          } else {
            pendingCandidatesRef.current.push(msg.candidate);
          }
          return;
        }

        if (msg.type === "peer-left") {
          // The signaling WebSocket dropped for the other person — this can
          // happen from a transient network blip (mobile data, flaky tunnel)
          // without their actual call/camera ending. WebRTC media is P2P and
          // independent of this signaling channel, so check whether it's
          // still actually flowing before tearing the call down.
          const pc = pcRef.current;
          if (pc && pc.connectionState === "connected") {
            return;
          }
          setStatus("ended");
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          setRemoteMuted(false);
          return;
        }

        if (msg.type === "chat") {
          setChatMessages((prev) => [...prev, { text: msg.text, at: msg.at, mine: false }]);
          if (!chatOpenRef.current) setUnreadChat((n) => n + 1);
          return;
        }

        if (msg.type === "caption") {
          setRemoteCaption(msg.text);
          if (remoteCaptionTimerRef.current) clearTimeout(remoteCaptionTimerRef.current);
          remoteCaptionTimerRef.current = setTimeout(() => setRemoteCaption(""), CAPTION_FADE_MS);
          if (msg.final && msg.text.trim() && myRoleRef.current) {
            const otherRole = myRoleRef.current === "candidate" ? "employer" : "candidate";
            transcriptRef.current.push({ speaker: otherRole, text: msg.text.trim() });
          }
        }
      };

      ws.onerror = () => setError("Lost connection to the call server.");
    }

    async function fetchIceServers() {
      try {
        const resp = await fetch(`${API_URL}/turn-credentials`, { headers: authHeader() });
        if (!resp.ok) return;
        const data = await resp.json();
        if (Array.isArray(data.iceServers) && data.iceServers.length) {
          iceServersRef.current = data.iceServers;
          console.log("[call] using TURN-backed ICE servers");
        }
      } catch (err) {
        console.warn("[call] failed to fetch TURN credentials, falling back to STUN-only", err);
      }
    }

    function startCaptioning() {
      if (typeof window === "undefined") return;
      const w = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      };
      const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!SR) return;

      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      captioningOnRef.current = true;

      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else interimText += result[0].transcript;
        }
        const text = (finalText || interimText).trim();
        if (!text) return;
        setMyCaption(text);
        if (myCaptionTimerRef.current) clearTimeout(myCaptionTimerRef.current);
        myCaptionTimerRef.current = setTimeout(() => setMyCaption(""), CAPTION_FADE_MS);
        if (finalText.trim() && myRoleRef.current) {
          transcriptRef.current.push({ speaker: myRoleRef.current, text: finalText.trim() });
        }
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "caption", text, final: !!finalText }));
        }
      };
      recognition.onerror = () => {};
      recognition.onend = () => {
        if (captioningOnRef.current) {
          try {
            recognition.start();
          } catch {
            // already running — ignore
          }
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // ignore — will retry on next toggle
      }
    }

    function stopCaptioning() {
      captioningOnRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setMyCaption("");
    }

    function pickRecorderMimeType(): string | undefined {
      const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
      for (const c of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
      }
      return undefined;
    }

    function startRecording(stream: MediaStream) {
      if (typeof MediaRecorder === "undefined") return;
      try {
        const mimeType = pickRecorderMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setRecording(true);
      } catch (err) {
        console.warn("[call] recording unavailable", err);
      }
    }

    async function stopRecordingAndUpload() {
      const recorder = mediaRecorderRef.current;
      if (!recorder || uploadedRef.current) return;
      uploadedRef.current = true;
      setRecording(false);

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        if (recorder.state !== "inactive") recorder.stop();
        else resolve();
      });

      const chunks = recordedChunksRef.current;
      recordedChunksRef.current = [];
      if (!chunks.length) return;

      try {
        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        const form = new FormData();
        form.append("file", blob, "recording.webm");
        await fetch(`${API_URL}/interviews/${roomId}/recording?participant=local`, {
          method: "POST",
          headers: authHeader(),
          body: form,
        });
      } catch (err) {
        console.warn("[call] failed to upload recording", err);
      }
    }

    async function submitCallEvaluation() {
      if (isOpenEdition()) return; // open source edition: no AI scoring, no scorecards
      if (evaluationSubmittedRef.current) return;
      const transcript = transcriptRef.current;
      if (transcript.length < MIN_TRANSCRIPT_TURNS) return;
      evaluationSubmittedRef.current = true;
      try {
        await fetch(`${API_URL}/interviews/${roomId}/call-evaluation`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify({ transcript }),
        });
      } catch (err) {
        console.warn("[call] failed to submit call evaluation", err);
      }
    }

    stopRecordingRef.current = stopRecordingAndUpload;
    stopCaptioningRef.current = stopCaptioning;
    startCaptioningRef.current = startCaptioning;
    connectSignalingRef.current = connectSignaling;
    submitEvaluationRef.current = submitCallEvaluation;

    async function start() {
      try {
        await fetchIceServers();
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setStatus("waiting");
        connectSignaling();
        startRecording(stream);
        startCaptioning();
      } catch (err) {
        setStatus("media-denied");
        setError(err instanceof Error ? err.message : "Could not access camera/microphone.");
      }
    }

    if (authToken) {
      start();
    }

    return () => {
      cancelled = true;
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
      if (myCaptionTimerRef.current) clearTimeout(myCaptionTimerRef.current);
      if (remoteCaptionTimerRef.current) clearTimeout(remoteCaptionTimerRef.current);
      stopCaptioning();
      stopRecordingAndUpload();
      submitCallEvaluation();
      wsRef.current?.close();
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId, authToken]);

  useEffect(() => {
    if (!requireSessionOrRedirect(["candidate", "employer"])) return;
    setAuthToken(getStoredToken());
    setStatus("requesting-media");
  }, []);

  // The self-view <video> can mount after the camera stream was obtained (and on phones the first
  // attach can stay black), so (re)attach it whenever the page state changes.
  useEffect(() => {
    const video = localVideoRef.current;
    const stream = screenSharing ? screenStreamRef.current : localStreamRef.current;
    if (video && stream && video.srcObject !== stream) video.srcObject = stream;
    video?.play().catch(() => {});
  }, [status, screenSharing, camOn, chatOpen]);

  // Browsers mute the other person's audio when the page joins without a tap. Turn it on at the
  // first tap, click or key press anywhere on the page.
  useEffect(() => {
    if (!remoteMuted) return;
    const unmute = () => {
      const video = remoteVideoRef.current;
      if (video) {
        video.muted = false;
        video.play().catch(() => {});
      }
      setRemoteMuted(false);
    };
    const events = ["pointerdown", "keydown", "touchend"] as const;
    events.forEach((e) => window.addEventListener(e, unmute, { once: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unmute));
  }, [remoteMuted]);

  useEffect(() => {
    if (status !== "connected") return;
    if (callStartRef.current === null) callStartRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - (callStartRef.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status !== "connected") return;
    const interval = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let rtt: number | undefined;
        let packetsLost = 0;
        let packetsReceived = 0;
        let jitter: number | undefined;
        stats.forEach((r) => {
          if (r.type === "candidate-pair" && r.state === "succeeded" && (r.selected ?? true)) {
            rtt = r.currentRoundTripTime;
          }
          if (r.type === "inbound-rtp" && r.kind === "video") {
            packetsLost = r.packetsLost ?? 0;
            packetsReceived = r.packetsReceived ?? 0;
            jitter = r.jitter;
          }
        });
        const total = packetsLost + packetsReceived;
        const lossRatio = total > 0 ? packetsLost / total : 0;
        let quality: ConnectionQuality = "good";
        if ((rtt !== undefined && rtt > 0.4) || lossRatio > 0.08 || (jitter !== undefined && jitter > 0.05)) {
          quality = "poor";
        } else if ((rtt !== undefined && rtt > 0.15) || lossRatio > 0.02) {
          quality = "fair";
        }
        setConnectionQuality(quality);
      } catch {
        // stats unavailable this tick — leave the last known quality showing
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [status]);

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }

  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }

  function leaveCall() {
    if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
    stopCaptioningRef.current();
    stopRecordingRef.current();
    submitEvaluationRef.current();
    wsRef.current?.close();
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    setStatus("ended");
  }

  async function toggleScreenShare() {
    if (screenSharing) {
      stopScreenShare();
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;
      screenStreamRef.current = screenStream;
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      await sender?.replaceTrack(screenTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      screenTrack.addEventListener("ended", () => stopScreenShare());
      setScreenSharing(true);
    } catch (err) {
      console.warn("[call] screen share unavailable", err);
    }
  }

  function stopScreenShare() {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
    if (cameraTrack) {
      sender?.replaceTrack(cameraTrack).catch(() => {});
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    setScreenSharing(false);
  }

  async function submitFeedback() {
    setFeedbackSubmitting(true);
    setFeedbackError(null);
    setFeedbackNeedsLogin(false);
    try {
      await updateInterview(roomId, {
        employer_feedback: feedbackText.trim() || undefined,
        employer_rating: feedbackRating || undefined,
      });
      setFeedbackSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/not authenticated|invalid or expired token|user not found/i.test(message)) {
        setFeedbackNeedsLogin(true);
        setFeedbackError("Your employer login has expired on this page. Log in again, then submit your feedback.");
      } else {
        setFeedbackError(message || "Could not save feedback.");
      }
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  async function handleConsentAccept() {
    await submitInterviewConsent(roomId, {
      recording_and_ai_evaluation: true,
      proctoring_and_identity_snapshot: true,
      data_storage_and_retention: true,
    });
    setStatus("waiting");
    connectSignalingRef.current();
  }

  function handleConsentDecline() {
    // Discard the local recording rather than uploading it — the candidate
    // declined consent, so nothing captured so far should be kept.
    recordedChunksRef.current = [];
    uploadedRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stopCaptioningRef.current();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setStatus("ended");
    setError("You declined the consent form, so the interview did not proceed.");
  }

  function toggleCaptions() {
    if (captionsOn) {
      stopCaptioningRef.current();
      setCaptionsOn(false);
    } else {
      startCaptioningRef.current();
      setCaptionsOn(true);
    }
  }

  function sendChat() {
    const text = chatInput.trim();
    const ws = wsRef.current;
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    const at = new Date().toISOString();
    ws.send(JSON.stringify({ type: "chat", text, at }));
    setChatMessages((prev) => [...prev, { text, at, mine: true }]);
    setChatInput("");
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable; nothing to fall back to safely
    }
  }

  if (status === "checking-access" && !authToken) return null;

  if (status === "consent") {
    return <ConsentGate onAccept={handleConsentAccept} onDecline={handleConsentDecline} />;
  }

  const roleLabel = myRole === "employer" ? "Employer" : myRole === "candidate" ? "Candidate" : "You";
  const otherLabel = myRole === "employer" ? "Candidate" : myRole === "candidate" ? "Interviewer" : "Participant";
  const qualityColor = connectionQuality === "good" ? "#22c55e" : connectionQuality === "fair" ? "#f59e0b" : "#ef4444";

  return (
    <div className={styles.root}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <BrandLogo height={36} />
          <span className={styles.brandSub}>Interview room</span>
        </div>

        <div className={styles.statusPill} title={debugInfo || undefined}>
          <span className={`${styles.dot} ${status === "connected" ? styles.dotOn : status === "ended" ? styles.dotEnd : ""}`} />
          <span>{STATUS_TEXT[status]}</span>
          {elapsedSeconds > 0 && (status === "connected" || status === "ended") && <span className={styles.timer}>{formatDuration(elapsedSeconds)}</span>}
          {connectionQuality && status === "connected" && (
            <span className={styles.q}>
              <i style={{ background: qualityColor }} />
              {connectionQuality === "good" ? "Good" : connectionQuality === "fair" ? "Fair" : "Poor"}
            </span>
          )}
        </div>

        <div className={styles.topRight}>
          {recording && (
            <span className={styles.rec}>
              <i /> REC
            </span>
          )}
          <button type="button" onClick={copyInviteLink} className={styles.ghost}>
            {copied ? "Link copied!" : "Copy invite link"}
          </button>
        </div>
      </header>

      <div className={styles.stage}>
        <div className={styles.main}>
          <video ref={remoteVideoRef} autoPlay playsInline className={styles.remote} />

          {status !== "connected" && (
            <div className={styles.waiting}>
              <div className={styles.ring}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.6" />
                  <path d="M4.5 20c.8-3.6 3.8-5.6 7.5-5.6s6.7 2 7.5 5.6" />
                </svg>
              </div>
              <div className={styles.waitTitle}>{status === "ended" ? "The call has ended" : status === "connecting" ? "Connecting…" : `Waiting for the ${otherLabel.toLowerCase()}`}</div>
              <div className={styles.waitSub}>
                {status === "ended"
                  ? "The other person has left the room."
                  : "You'll see each other as soon as they join. Share the invite link if they haven't got it."}
              </div>
            </div>
          )}

          {remoteMuted && status === "connected" && (
            <button
              type="button"
              className={styles.sound}
              onClick={() => {
                const video = remoteVideoRef.current;
                if (video) {
                  video.muted = false;
                  video.play().catch(() => {});
                }
                setRemoteMuted(false);
              }}
            >
              🔊 Tap to turn on sound
            </button>
          )}

          {status === "connected" && <span className={styles.tag}>{otherLabel}</span>}

          {captionsOn && (remoteCaption || myCaption) && (
            <div className={styles.captions}>
              {remoteCaption && <span className={styles.capRemote}>{remoteCaption}</span>}
              {myCaption && <span className={styles.capMine}>{myCaption}</span>}
            </div>
          )}

          <div className={styles.self}>
            <video ref={localVideoRef} autoPlay playsInline muted />
            {!camOn && !screenSharing && <div className={styles.camOff}>Camera off</div>}
            <span className={styles.selfTag}>{screenSharing ? "Your screen" : `You · ${roleLabel}`}</span>
          </div>
        </div>

        {chatOpen && (
          <aside className={styles.chat} aria-label="Chat">
            <div className={styles.chatHead}>
              <span>Chat</span>
              <button type="button" onClick={() => setChatOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>
            <div className={styles.chatBody}>
              {chatMessages.length === 0 ? (
                <p className={styles.chatEmpty}>No messages yet. Say hello 👋</p>
              ) : (
                chatMessages.map((m, i) => (
                  <div key={i} className={`${styles.msg} ${m.mine ? styles.msgMine : ""}`}>
                    {m.text}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <form
              className={styles.chatForm}
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
            >
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message…" />
              <button type="submit" className={styles.send} disabled={!chatInput.trim()}>
                Send
              </button>
            </form>
          </aside>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.dock}>
        <div className={styles.dockIn}>
          <button type="button" onClick={toggleMic} className={`${styles.ctl} ${!micOn ? styles.ctlOff : ""}`} aria-pressed={!micOn}>
            <CtlIcon name={micOn ? "mic" : "micOff"} />
            {micOn ? "Mute" : "Unmute"}
          </button>
          <button type="button" onClick={toggleCam} className={`${styles.ctl} ${!camOn ? styles.ctlOff : ""}`} aria-pressed={!camOn}>
            <CtlIcon name={camOn ? "cam" : "camOff"} />
            {camOn ? "Camera" : "Start cam"}
          </button>
          <button type="button" onClick={toggleCaptions} className={`${styles.ctl} ${captionsOn ? styles.ctlOn : ""}`} aria-pressed={captionsOn}>
            <CtlIcon name="cc" />
            Captions
          </button>
          <button type="button" onClick={toggleScreenShare} className={`${styles.ctl} ${screenSharing ? styles.ctlOn : ""}`} aria-pressed={screenSharing}>
            <CtlIcon name="share" />
            {screenSharing ? "Stop share" : "Share"}
          </button>
          <button type="button" onClick={() => setChatOpen((v) => !v)} className={`${styles.ctl} ${chatOpen ? styles.ctlOn : ""}`} aria-pressed={chatOpen}>
            <CtlIcon name="chat" />
            Chat
            {unreadChat > 0 && <span className={styles.badge}>{unreadChat}</span>}
          </button>
          <button type="button" onClick={leaveCall} className={`${styles.ctl} ${styles.leave}`}>
            <CtlIcon name="leave" />
            Leave
          </button>
        </div>
      </div>

      {myRole === "employer" && status === "ended" && (
        <section className={styles.feedback}>
          <h3>Interview feedback</h3>
          {feedbackSubmitted ? (
            <p className={styles.ok}>Feedback saved.</p>
          ) : (
            <>
              <div className={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFeedbackRating(n)}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    className={n <= feedbackRating ? styles.starOn : ""}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Notes on this candidate…" rows={3} />
              {feedbackError && (
                <p className={styles.fbErr} role="alert">
                  {feedbackError}{" "}
                  {feedbackNeedsLogin && (
                    <a href="/login?role=employer" target="_blank" rel="noreferrer">
                      Log in
                    </a>
                  )}
                </p>
              )}
              <button
                type="button"
                onClick={submitFeedback}
                disabled={feedbackSubmitting || (!feedbackRating && !feedbackText.trim())}
                className={styles.primary}
              >
                {feedbackSubmitting ? "Saving…" : "Submit feedback"}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}

type IconName = "mic" | "micOff" | "cam" | "camOff" | "cc" | "share" | "chat" | "leave";

function CtlIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </>
    ),
    micOff: (
      <>
        <path d="M3 3l18 18" />
        <path d="M9 9v2a3 3 0 0 0 5 2.2M15 9.5V6a3 3 0 0 0-5.7-1.3" />
        <path d="M5 11a7 7 0 0 0 11.2 5.6M19 11a7 7 0 0 1-.5 2.6M12 18v3" />
      </>
    ),
    cam: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="2.5" />
        <path d="M16 10l5-3v10l-5-3" />
      </>
    ),
    camOff: (
      <>
        <path d="M3 3l18 18" />
        <path d="M7 6h6.5A2.5 2.5 0 0 1 16 8.5V12M16 15.5V16a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 15.5v-7" />
        <path d="M16 10l5-3v10l-3-1.8" />
      </>
    ),
    cc: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M10 10.5a2 2 0 1 0 0 3M16 10.5a2 2 0 1 0 0 3" />
      </>
    ),
    share: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4M9.5 10.5L12 8l2.5 2.5M12 8v5" />
      </>
    ),
    chat: <path d="M4 5h16v11H9l-5 4V5z" />,
    leave: <path d="M4 15c4-4 12-4 16 0l-2.5 2.5-3-1.5v-2.5a9 9 0 0 0-5 0V16l-3 1.5L4 15z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
