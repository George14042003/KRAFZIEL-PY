export type Role = "candidate" | "employer" | "super_admin";

export type LoginPayload = {
  role: Role;
  email: string;
  password: string;
  remember: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_verified: boolean;
  organization_id: string | null;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";
const TOKEN_KEY = "naie_access_token";
const USER_KEY = "naie_user";

function storeSession(data: TokenResponse, remember: boolean): AuthUser {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, data.access_token);
  storage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export async function login(payload: LoginPayload): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Invalid email or password.");
  }

  const data: TokenResponse = await res.json();
  return storeSession(data, payload.remember);
}

export async function loginWithGoogle(role: Role, accessToken: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, access_token: accessToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Google sign-in failed.");
  }

  const data: TokenResponse = await res.json();
  return storeSession(data, true);
}

export type RegisterPayload = {
  role: Role;
  fullName: string;
  email: string;
  password: string;
  /** Required for role "employer" — becomes the name of their new organization. */
  organizationName?: string;
};

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/register/${payload.role}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      full_name: payload.fullName,
      ...(payload.role === "employer" ? { organization_name: payload.organizationName } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Could not create your account.");
  }

  return res.json();
}

async function postMessage(path: string, body: unknown): Promise<string> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail ?? "Something went wrong. Please try again.");
  }
  return data?.detail ?? "";
}

export function resendVerificationEmail(email: string): Promise<string> {
  return postMessage("/auth/resend-verification", { email });
}

export async function verifyEmail(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail ?? "This link is invalid or has expired.");
  }
  return data;
}

export function requestPasswordReset(email: string): Promise<string> {
  return postMessage("/auth/forgot-password", { email });
}

export function resetPassword(token: string, newPassword: string): Promise<string> {
  return postMessage("/auth/reset-password", { token, new_password: newPassword });
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = new Error("Session expired.") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  try {
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

function authedHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function updateStoredUser(user: AuthUser): void {
  const storage = localStorage.getItem(USER_KEY) ? localStorage : sessionStorage;
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export async function updateProfile(fullName: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authedHeaders() },
    body: JSON.stringify({ full_name: fullName }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail ?? "Could not update your profile.");
  }
  updateStoredUser(data);
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/me/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authedHeaders() },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail ?? "Could not update your password.");
  }
  return data?.detail ?? "";
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

/** Only same-site relative paths may be used as a post-login destination. */
export function safeNextPath(value: string | null): string | null {
  // Browsers drop tabs and newlines when parsing URLs, so "/<TAB>/host" would become "//host".
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  return value.startsWith("/") && !/^\/[\\/]/.test(value) ? value : null;
}

/** Page guard for interview links: returns the logged-in user if their role is allowed,
 * otherwise sends the browser to the login page (which brings them back here after
 * signing in) and returns null. */
export function requireSessionOrRedirect(roles: Role[]): AuthUser | null {
  const user = getStoredToken() ? getStoredUser() : null;
  if (user && roles.includes(user.role)) return user;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/login?role=${roles[0]}&next=${next}`);
  return null;
}
