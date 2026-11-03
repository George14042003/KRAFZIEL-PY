/** Optional encryption of API request bodies and JSON responses, with keys that rotate every 5 to 10 minutes.
 *
 * Off unless NEXT_PUBLIC_ENCRYPT_API=true (and the backend has ENCRYPT_API=optional or required). It wraps
 * window.fetch so no caller changes. It sits on top of TLS and does not replace it. It hides payloads from
 * anything that only sees network traffic (proxies, logs, the Network tab's request, response and preview
 * panes); it cannot hide data from the person using this browser, because this page has to hold the key and the
 * plaintext to work. Authorization headers and URLs are not encrypted. This file has no imports so it can be
 * tested directly in Node. */

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type SecureFetchOptions = {
  baseFetch: FetchLike;
  /** Origin that relative URLs resolve against, e.g. window.location.origin. */
  baseOrigin: string;
  /** Other origins that serve the API (when the API is not proxied through this site). */
  extraOrigins?: string[];
  now?: () => number;
};

const API_PREFIXES = [
  "avatar", "auth", "candidates", "interviews", "notifications", "billing", "offers", "jobs", "job-applications",
  "me", "admin", "public", "mock-interviews", "turn-credentials",
];
const NEVER = ["/media", "/ws", "/health", "/open", "/secure", "/billing/webhook"];
const RENEW_AT = 0.75;
const DISABLED_RETRY_MS = 5 * 60 * 1000;
const KEEP_KEYS = 4;
const INFO_PREFIX = "krafziel-transport-v1|";

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64e(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64d(text: string): Uint8Array {
  const pad = text + "=".repeat((4 - (text.length % 4)) % 4);
  const bin = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

type Session = { kid: string; key: CryptoKey; issuedAt: number; lifetimeMs: number };

function decodedPath(url: URL): string {
  try {
    return decodeURIComponent(url.pathname);
  } catch {
    return url.pathname;
  }
}

export function isProtectedPath(pathname: string): boolean {
  if (NEVER.some((p) => pathname === p || pathname.startsWith(p + "/"))) return false;
  return API_PREFIXES.some((p) => pathname === "/" + p || pathname.startsWith("/" + p + "/"));
}

export function createSecureFetch(opts: SecureFetchOptions): FetchLike {
  const now = opts.now ?? (() => Date.now());
  const origins = new Set([opts.baseOrigin, ...(opts.extraOrigins ?? [])]);
  const sessions = new Map<string, Session>();
  const known = new Map<string, CryptoKey>();
  const pending = new Map<string, Promise<Session | null>>();
  const disabledUntil = new Map<string, number>();

  async function handshake(origin: string): Promise<Session | null> {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const res = await opts.baseFetch(origin + "/secure/handshake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pub: b64e(pub) }),
    });
    if (!res.ok) return null;
    const h = await res.json();
    if (!h.enabled) {
      disabledUntil.set(origin, now() + DISABLED_RETRY_MS);
      return null;
    }
    const serverPub = await crypto.subtle.importKey("raw", b64d(h.pub) as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: serverPub }, pair.privateKey, 256);
    const hkdf = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: b64d(h.salt) as BufferSource, info: enc.encode(INFO_PREFIX + h.kid) },
      hkdf,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    const session: Session = { kid: h.kid, key, issuedAt: now(), lifetimeMs: h.lifetime * 1000 };
    known.set(h.kid, key);
    while (known.size > KEEP_KEYS) known.delete(known.keys().next().value as string);
    return session;
  }

  /** The current key for an origin, replaced once it is 75% through its lifetime (or when forced). */
  async function ensureSession(origin: string, force: boolean): Promise<Session | null> {
    const existing = sessions.get(origin);
    if (!force && existing && now() - existing.issuedAt < existing.lifetimeMs * RENEW_AT) return existing;
    let inflight = pending.get(origin);
    if (!inflight) {
      inflight = handshake(origin)
        .catch(() => null)
        .then((s) => {
          if (s) sessions.set(origin, s);
          else if (!(existing && now() - existing.issuedAt < existing.lifetimeMs)) disabledUntil.set(origin, now() + 30_000);
          return s ?? (force ? null : existing && now() - existing.issuedAt < existing.lifetimeMs ? existing : null);
        })
        .finally(() => pending.delete(origin));
      pending.set(origin, inflight);
    }
    return inflight;
  }

  async function seal(key: CryptoKey, plaintext: Uint8Array, aad: string): Promise<{ iv: string; ct: string }> {
    const iv = randomBytes(12);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: enc.encode(aad) }, key, plaintext as BufferSource);
    return { iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
  }

  async function open(res: Response, rid: string, path: string): Promise<Response> {
    if (res.headers.get("X-Enc") !== "v1") return res;
    const fail = (message: string) =>
      new Response(JSON.stringify({ detail: message }), { status: 502, headers: { "Content-Type": "application/json" } });
    try {
      const env = await res.json();
      const key = known.get(env.kid);
      if (!key) return fail("The secure response used an unknown key.");
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64d(env.iv) as BufferSource, additionalData: enc.encode(`v1|resp|${res.status}|${rid}|${path}`) },
        key,
        b64d(env.ct) as BufferSource
      );
      const headers = new Headers(res.headers);
      headers.delete("content-length");
      headers.delete("x-enc");
      headers.set("Content-Type", "application/json");
      return new Response(dec.decode(plain), { status: res.status, statusText: res.statusText, headers });
    } catch {
      return fail("The secure response could not be verified.");
    }
  }

  return async function secureFetch(input, init) {
    let url: URL;
    try {
      if (typeof input === "string") url = new URL(input, opts.baseOrigin);
      else if (input instanceof URL) url = input;
      else return opts.baseFetch(input, init);
    } catch {
      return opts.baseFetch(input, init);
    }
    if (!origins.has(url.origin) || !isProtectedPath(url.pathname)) return opts.baseFetch(input, init);
    if (now() < (disabledUntil.get(url.origin) ?? 0)) return opts.baseFetch(input, init);

    const method = (init?.method ?? "GET").toUpperCase();
    const path = decodedPath(url);
    for (let attempt = 0; attempt < 2; attempt++) {
      const session = await ensureSession(url.origin, attempt > 0);
      if (!session) return opts.baseFetch(input, init);

      const rid = b64e(randomBytes(16));
      const headers = new Headers(init?.headers);
      headers.set("X-Enc-Kid", session.kid);
      headers.set("X-Enc-Rid", rid);
      let body = init?.body;
      const contentType = (headers.get("Content-Type") ?? "").toLowerCase();
      if (typeof body === "string" && body.length > 0 && (!contentType || contentType.includes("json"))) {
        const sealed = await seal(
          session.key,
          enc.encode(JSON.stringify({ b: body, t: Date.now(), r: rid })), // wall-clock time: the server checks it against its own
          `v1|${method}|${path}`
        );
        body = JSON.stringify(sealed);
        headers.set("X-Enc-Body", "1");
        headers.set("Content-Type", "application/json");
      }

      const res = await opts.baseFetch(url.toString(), { ...init, headers, body });
      if (res.status === 428 && res.headers.get("X-Enc-Error") === "rekey" && attempt === 0) {
        sessions.delete(url.origin);
        continue;
      }
      return open(res, rid, path);
    }
    return opts.baseFetch(input, init);
  };
}

/** Installs the wrapper on window.fetch once, when NEXT_PUBLIC_ENCRYPT_API=true. */
export function installSecureFetch(): void {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_ENCRYPT_API !== "true") return;
  const w = window as unknown as { __secureFetchInstalled?: boolean };
  if (w.__secureFetchInstalled || !window.crypto?.subtle) return;
  w.__secureFetchInstalled = true;
  const extra: string[] = [];
  try {
    const api = process.env.NEXT_PUBLIC_API_URL;
    if (api) extra.push(new URL(api).origin);
  } catch {
    // a relative or empty API URL means the API is served through this site
  }
  window.fetch = createSecureFetch({ baseFetch: window.fetch.bind(window), baseOrigin: window.location.origin, extraOrigins: extra });
}
