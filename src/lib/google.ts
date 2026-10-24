type TokenClientResponse = {
  access_token?: string;
  error?: string;
};

type GoogleAccounts = {
  oauth2: {
    initTokenClient(config: {
      client_id: string;
      scope: string;
      callback: (response: TokenClientResponse) => void;
    }): { requestAccessToken: () => void };
  };
};

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

export type GoogleAccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; error: string };

export function requestGoogleAccessToken(): Promise<GoogleAccessTokenResult> {
  return new Promise((resolve) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      resolve({ ok: false, error: "Google sign-in isn't configured yet." });
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      resolve({ ok: false, error: "Google sign-in hasn't finished loading. Try again in a moment." });
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: (response) => {
        if (response.error || !response.access_token) {
          resolve({ ok: false, error: "Google sign-in was cancelled or failed." });
          return;
        }
        resolve({ ok: true, accessToken: response.access_token });
      },
    });

    client.requestAccessToken();
  });
}
