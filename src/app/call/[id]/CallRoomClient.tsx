"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ConsentGate } from "@/components/interview/ConsentGate";
import { captureVideoFrame } from "@/lib/captureSnapshot";
import { submitInterviewConsent, updateInterview, uploadIdentitySnapshot } from "@/lib/candidates";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";
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
  | "email-gate"
  | "checking-access"
  | "consent"
  | "requesting-media"
  | "media-denied"
  | "waiting"
  | "connecting"
  | "connected"
  | "ended";

const STATUS_TEXT: Record<CallStatus, string> = {
  "email-gate": "Confirm your email to join…",
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

  const [status, setStatus] = useState<CallStatus>("email-gate");
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailGateError, setEmailGateError] = useState<string | null>(null);
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
      const ws = new WebSocket(`${WS_URL}/ws/call/${roomId}?email=${encodeURIComponent(confirmedEmail ?? "")}`);
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
          setError("That email isn't associated with this interview.");
          ws.close();
          return;
        }

        if (msg.type === "role-taken") {
          setStatus("ended");
          setError(
            "Someone has already joined this interview with that email. If this isn't you, contact your recruiter."
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
        const resp = await fetch(`${API_URL}/turn-credentials`);
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
          body: form,
        });
      } catch (err) {
        console.warn("[call] failed to upload recording", err);
      }
    }

    async function submitCallEvaluation() {
      if (evaluationSubmittedRef.current) return;
      const transcript = transcriptRef.current;
      if (transcript.length < MIN_TRANSCRIPT_TURNS) return;
      evaluationSubmittedRef.current = true;
      try {
        await fetch(`${API_URL}/interviews/${roomId}/call-evaluation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

    if (confirmedEmail) {
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
  }, [roomId, confirmedEmail]);

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
    try {
      await updateInterview(roomId, {
        employer_feedback: feedbackText.trim() || undefined,
        employer_rating: feedbackRating || undefined,
      });
      setFeedbackSubmitted(true);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Could not save feedback.");
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

  function submitEmailGate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailGateError("Enter a valid email address.");
      return;
    }
    setEmailGateError(null);
    setConfirmedEmail(trimmed);
    setStatus("requesting-media");
  }

  if (status === "email-gate") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a0c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <form
          onSubmit={submitEmailGate}
          style={{
            width: "100%",
            maxWidth: "380px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "16px",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <h1 style={{ fontSize: "16px", fontWeight: 800, color: "#fff", margin: 0 }}>
            Confirm your email to join
          </h1>
          <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>
            This confirms you're the candidate or interviewer this call was set up for — each side can only
            join once.
          </p>
          <input
            type="email"
            required
            autoFocus
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="you@example.com"
            style={{
              padding: "11px 14px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              fontSize: "13px",
            }}
          />
          {emailGateError && (
            <p style={{ fontSize: "12px", color: "#fca5a5", margin: 0 }} role="alert">
              {emailGateError}
            </p>
          )}
          <button
            type="submit"
            style={{
              padding: "11px",
              borderRadius: "10px",
              border: "none",
              background: "#01617a",
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Continue to call
          </button>
        </form>
      </div>
    );
  }

  if (status === "consent") {
    return <ConsentGate onAccept={handleConsentAccept} onDecline={handleConsentDecline} />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0c",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: status === "connected" ? "#22c55e" : status === "ended" ? "#64748b" : "#f59e0b",
          }}
        />
        <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
          {STATUS_TEXT[status]}
        </span>
        {recording && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 800, color: "#f87171" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#f87171" }} />
            REC
          </span>
        )}
        {elapsedSeconds > 0 && (status === "connected" || status === "ended") && (
          <span style={{ fontSize: "12px", fontFamily: "monospace", color: "rgba(255,255,255,0.7)" }}>
            {formatDuration(elapsedSeconds)}
          </span>
        )}
        {connectionQuality && status === "connected" && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background:
                  connectionQuality === "good" ? "#22c55e" : connectionQuality === "fair" ? "#f59e0b" : "#ef4444",
              }}
            />
            {connectionQuality === "good" ? "Good" : connectionQuality === "fair" ? "Fair" : "Poor"} connection
          </span>
        )}
        {debugInfo && (
          <span style={{ fontSize: "10px", fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>
            {debugInfo}
          </span>
        )}
        <button
          type="button"
          onClick={copyInviteLink}
          style={{
            marginLeft: "12px",
            padding: "6px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {copied ? "Link copied!" : "Copy invite link"}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: "13px", color: "#fca5a5", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", width: "min(1240px, 100%)", justifyContent: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", flex: "1 1 auto", minWidth: 0 }}>
          <div
            style={{
              position: "relative",
              width: "min(960px, 100%)",
              aspectRatio: "16 / 9",
              background: "#000",
              borderRadius: "16px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", background: "#111" }}
            />
            {remoteMuted && status === "connected" && (
              <button
                type="button"
                onClick={() => {
                  const video = remoteVideoRef.current;
                  if (video) {
                    video.muted = false;
                    video.play().catch(() => {});
                  }
                  setRemoteMuted(false);
                }}
                style={{
                  position: "absolute",
                  top: "12px",
                  left: "12px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🔇 Unmute
              </button>
            )}
            {status !== "connected" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "13px",
                }}
              >
                {status === "ended" ? "The other person has left." : "Waiting for the other participant’s video…"}
              </div>
            )}

            {captionsOn && (remoteCaption || myCaption) && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: "20px",
                  transform: "translateX(-50%)",
                  maxWidth: "88%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                  pointerEvents: "none",
                }}
              >
                {remoteCaption && (
                  <span
                    style={{
                      background: "rgba(0,0,0,0.65)",
                      color: "#fff",
                      fontSize: "14px",
                      fontWeight: 600,
                      padding: "6px 12px",
                      borderRadius: "8px",
                      lineHeight: 1.4,
                    }}
                  >
                    {remoteCaption}
                  </span>
                )}
                {myCaption && (
                  <span
                    style={{
                      background: "rgba(0,0,0,0.45)",
                      color: "rgba(255,255,255,0.75)",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      padding: "5px 10px",
                      borderRadius: "8px",
                      lineHeight: 1.4,
                    }}
                  >
                    {myCaption}
                  </span>
                )}
              </div>
            )}

            <div
              style={{
                position: "absolute",
                bottom: "16px",
                right: "16px",
                width: "160px",
                aspectRatio: "16 / 9",
                borderRadius: "10px",
                overflow: "hidden",
                border: "2px solid rgba(255,255,255,0.3)",
                background: "#000",
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" onClick={toggleMic} style={controlButtonStyle(!micOn)}>
              {micOn ? "Mute" : "Unmute"}
            </button>
            <button type="button" onClick={toggleCam} style={controlButtonStyle(!camOn)}>
              {camOn ? "Stop Camera" : "Start Camera"}
            </button>
            <button type="button" onClick={toggleCaptions} style={controlButtonStyle(captionsOn)}>
              {captionsOn ? "Captions On" : "Captions Off"}
            </button>
            <button type="button" onClick={toggleScreenShare} style={controlButtonStyle(screenSharing)}>
              {screenSharing ? "Stop Sharing" : "Share Screen"}
            </button>
            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              style={{ ...controlButtonStyle(chatOpen), position: "relative" }}
            >
              Chat
              {unreadChat > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-6px",
                    background: "#01617a",
                    color: "#fff",
                    borderRadius: "999px",
                    fontSize: "10px",
                    fontWeight: 800,
                    minWidth: "18px",
                    height: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                  }}
                >
                  {unreadChat}
                </span>
              )}
            </button>
            <button type="button" onClick={leaveCall} style={{ ...controlButtonStyle(false), background: "#dc2626", color: "#fff" }}>
              Leave
            </button>
          </div>
        </div>

        {chatOpen && (
          <div
            style={{
              width: "280px",
              flexShrink: 0,
              height: "min(540px, 70vh)",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                fontSize: "12px",
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Chat
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {chatMessages.length === 0 ? (
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>No messages yet.</p>
              ) : (
                chatMessages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.mine ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      background: m.mine ? "#01617a" : "rgba(255,255,255,0.1)",
                      color: "#fff",
                      padding: "7px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      lineHeight: 1.4,
                      wordBreak: "break-word",
                    }}
                  >
                    {m.text}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
              style={{ display: "flex", gap: "6px", padding: "10px", borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message…"
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontSize: "12px",
                }}
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#01617a",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: chatInput.trim() ? "pointer" : "default",
                  opacity: chatInput.trim() ? 1 : 0.6,
                }}
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      {myRole === "employer" && status === "ended" && (
        <div
          style={{
            width: "min(960px, 100%)",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "16px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>Interview feedback</div>
          {feedbackSubmitted ? (
            <p style={{ fontSize: "12.5px", color: "#4ade80", margin: 0 }}>Feedback saved.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: "6px" }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFeedbackRating(n)}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "22px",
                      lineHeight: 1,
                      cursor: "pointer",
                      color: n <= feedbackRating ? "#facc15" : "rgba(255,255,255,0.25)",
                      padding: 0,
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Notes on this candidate…"
                rows={3}
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontSize: "12.5px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
              {feedbackError && (
                <p style={{ fontSize: "12px", color: "#fca5a5", margin: 0 }} role="alert">
                  {feedbackError}
                </p>
              )}
              <button
                type="button"
                onClick={submitFeedback}
                disabled={feedbackSubmitting || (!feedbackRating && !feedbackText.trim())}
                style={{
                  alignSelf: "flex-start",
                  padding: "9px 16px",
                  borderRadius: "9px",
                  border: "none",
                  background: "#01617a",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: feedbackSubmitting ? "default" : "pointer",
                  opacity: feedbackSubmitting || (!feedbackRating && !feedbackText.trim()) ? 0.6 : 1,
                }}
              >
                {feedbackSubmitting ? "Saving…" : "Submit Feedback"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function controlButtonStyle(active: boolean): CSSProperties {
  return {
    padding: "10px 18px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: active ? "rgba(8,145,178,0.3)" : "rgba(255,255,255,0.08)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
  };
}
