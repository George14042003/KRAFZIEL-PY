"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { useEffect, useState } from "react";
import styles from "./OpenSource.module.css";

type Participant = { id: string; name: string; role: string; token: string; join_url: string };
type Room = { room_id: string; expires_at: string; participants: Participant[] };

const ENDPOINTS: { method: string; path: string; auth: string; what: string }[] = [
  { method: "POST", path: "/open/v1/rooms", auth: "API key", what: "Create a room and get one join link per participant." },
  { method: "GET", path: "/open/v1/rooms/{room_id}", auth: "API key", what: "Live status: who is connected, closed or not, recordings." },
  { method: "POST", path: "/open/v1/rooms/{room_id}/tokens", auth: "API key", what: "Mint another join link (re-invite, add a person)." },
  { method: "DELETE", path: "/open/v1/rooms/{room_id}", auth: "API key", what: "End the room: disconnect everyone and revoke every link." },
  { method: "GET", path: "/open/v1/rooms/{room_id}/recordings", auth: "API key", what: "List recorded clips for the room." },
  { method: "POST", path: "/open/v1/rooms/{room_id}/recordings?token=", auth: "Join token", what: "A participant uploads their own recording (webm)." },
  { method: "GET", path: "/open/v1/ice-servers?token=", auth: "Join token", what: "STUN/TURN servers for your own WebRTC client." },
  { method: "WS", path: "/ws/open/{room_id}?token=", auth: "Join token", what: "Signaling relay for two peers (offer, answer, ice-candidate)." },
];

export function OpenSourceClient() {
  const [origin, setOrigin] = useState("https://your-domain");
  const [apiKey, setApiKey] = useState("");
  const [names, setNames] = useState({ host: "Host", guest: "Guest" });
  const [minutes, setMinutes] = useState(120);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<"curl" | "js" | "python">("curl");

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      setApiKey(localStorage.getItem("maata_open_key") ?? "");
    } catch {}
  }, []);

  async function createRoom() {
    setBusy(true);
    setError(null);
    setRoom(null);
    try {
      localStorage.setItem("maata_open_key", apiKey);
    } catch {}
    try {
      const res = await fetch("/open/v1/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey.trim() },
        body: JSON.stringify({
          participants: [
            { name: names.host || "Host", role: "host" },
            { name: names.guest || "Guest", role: "guest" },
          ],
          expires_in_minutes: minutes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Request failed (${res.status})`);
      setRoom(data as Room);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function copy(key: string, text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  }

  const samples = {
    curl: `# 1. Create a room (server side, keep the key secret)
curl -X POST ${origin}/open/v1/rooms \\
  -H "X-API-Key: $MAATA_OPEN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"participants":[{"name":"Priya","role":"host"},{"name":"Sam","role":"guest"}],"expires_in_minutes":60}'

# 2. Send each participant their "join_url" from the response.
# 3. Later: status, recordings, end the room.
curl ${origin}/open/v1/rooms/ROOM_ID -H "X-API-Key: $MAATA_OPEN_KEY"
curl -X DELETE ${origin}/open/v1/rooms/ROOM_ID -H "X-API-Key: $MAATA_OPEN_KEY"`,
    js: `const res = await fetch("${origin}/open/v1/rooms", {
  method: "POST",
  headers: { "X-API-Key": process.env.MAATA_OPEN_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    participants: [{ name: "Priya", role: "host" }, { name: "Sam", role: "guest" }],
    expires_in_minutes: 60,
  }),
});
const room = await res.json();
console.log(room.participants.map((p) => p.join_url));

// Building your own UI? Use the token directly:
//   new WebSocket("wss://<host>/ws/open/" + room.room_id + "?token=" + p.token)`,
    python: `import os, requests

r = requests.post(
    "${origin}/open/v1/rooms",
    headers={"X-API-Key": os.environ["MAATA_OPEN_KEY"]},
    json={
        "participants": [{"name": "Priya", "role": "host"}, {"name": "Sam", "role": "guest"}],
        "expires_in_minutes": 60,
    },
    timeout=15,
)
r.raise_for_status()
room = r.json()
for p in room["participants"]:
    print(p["name"], p["join_url"])`,
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerIn}>
          <Link href="/" className={styles.logo} aria-label="Elzuron, home">
            <BrandLogo height="clamp(26px, 8.5vw, 40px)" />
          </Link>
          <Link href="/" className={styles.back}>
            ← Home page
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroIn}>
          <span className={styles.eyebrow}>Open source · API</span>
          <h1>
            Video interviews as an <span className={styles.grad}>API.</span>
          </h1>
          <p>
            Create a 1:1 video room with one request, hand each person a link, and optionally collect recordings. No accounts, no database,
            and no AI or OpenAI calls anywhere in the path.
          </p>
          <div className={styles.pills}>
            <span>No AI / OpenAI</span>
            <span>No sign-up for guests</span>
            <span>WebRTC, peer to peer</span>
            <span>REST + WebSocket</span>
          </div>
        </div>
      </section>

      <main className={styles.main}>
        <section className={styles.card}>
          <h2>Try it now</h2>
          <p className={styles.muted}>
            Paste your API key, create a room and open the two links in separate browser windows (or send one to a friend). The key is sent only to
            this site&apos;s own API.
          </p>
          <div className={styles.form}>
            <label>
              API key
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="maata_open_…" autoComplete="off" />
            </label>
            <label>
              Host name
              <input value={names.host} onChange={(e) => setNames({ ...names, host: e.target.value })} maxLength={80} />
            </label>
            <label>
              Guest name
              <input value={names.guest} onChange={(e) => setNames({ ...names, guest: e.target.value })} maxLength={80} />
            </label>
            <label>
              Links valid for
              <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                <option value={30}>30 minutes</option>
                <option value={120}>2 hours</option>
                <option value={1440}>24 hours</option>
                <option value={10080}>7 days</option>
              </select>
            </label>
          </div>
          <button type="button" className={styles.primary} disabled={busy || !apiKey.trim()} onClick={createRoom}>
            {busy ? "Creating…" : "Create room"}
          </button>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {room && (
            <div className={styles.result}>
              <div className={styles.rid}>
                Room <code>{room.room_id}</code>
              </div>
              {room.participants.map((p) => (
                <div key={p.id} className={styles.link}>
                  <div>
                    <strong>{p.name}</strong> <span className={styles.role}>{p.role}</span>
                    <div className={styles.url}>{p.join_url}</div>
                  </div>
                  <div className={styles.linkBtns}>
                    <button type="button" onClick={() => copy(p.id, p.join_url)}>
                      {copied === p.id ? "Copied" : "Copy"}
                    </button>
                    <a href={p.join_url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <h2>Quick start</h2>
          <div className={styles.tabs} role="tablist">
            {(["curl", "js", "python"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? styles.tabOn : ""} onClick={() => setTab(t)}>
                {t === "js" ? "JavaScript" : t === "curl" ? "cURL" : "Python"}
              </button>
            ))}
          </div>
          <div className={styles.codeWrap}>
            <button type="button" className={styles.copyCode} onClick={() => copy("code", samples[tab])}>
              {copied === "code" ? "Copied" : "Copy"}
            </button>
            <pre className={styles.code}>{samples[tab]}</pre>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Endpoints</h2>
          <p className={styles.muted}>
            Base URL <code>{origin}</code>. Send your key as <code>X-API-Key</code> (or <code>Authorization: Bearer</code>). Participant calls use the
            join token instead.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Auth</th>
                  <th>What it does</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr key={e.method + e.path}>
                    <td>
                      <span className={`${styles.m} ${styles["m" + e.method]}`}>{e.method}</span>
                    </td>
                    <td>
                      <code>{e.path}</code>
                    </td>
                    <td>{e.auth}</td>
                    <td>{e.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Good to know</h2>
          <ul className={styles.list}>
            <li>
              <strong>API keys.</strong> Set <code>OPEN_API_KEYS</code> (comma separated) in the backend environment. If it is not set, the backend
              prints a development key in its startup log.
            </li>
            <li>
              <strong>Two people per room.</strong> Each link is tied to one participant and only one connection per link is allowed, so a forwarded
              link cannot be used from a second place.
            </li>
            <li>
              <strong>Nothing stored but recordings.</strong> Rooms and join links live in signed tokens, so there is no database. Recordings are
              files under <code>media/open-recordings/&lt;room_id&gt;/</code>.
            </li>
            <li>
              <strong>One backend process.</strong> Live connection state is kept in memory, so run a single worker, and add TURN credentials
              (<code>TURN_KEY_ID</code>, <code>TURN_API_TOKEN</code>) for callers behind strict networks.
            </li>
          </ul>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} Elzuron. All rights reserved.</span>
        <span className={styles.footerLinks}>
          <Link href="/about">About us</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
        </span>
      </footer>
    </div>
  );
}
