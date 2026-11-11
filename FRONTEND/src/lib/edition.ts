import { useSyncExternalStore } from "react";

/** "Open source" edition: the same app, limited to live video interviews (no bot interviews, AI
 * scoring, scorecards, offers, jobs or reports). It is a per-browser switch set from the home page
 * button (`/login?edition=open`) and cleared by signing in the normal way or by leaving via "Main Site".
 * This is a UI edition: it hides and redirects, it does not change what the API allows. */

const KEY = "maata_edition";
const EVENT = "maata-edition-change";

export type EditionRole = "employer" | "candidate";

/** Pages reachable in the open edition, per role (a path matches itself and anything under it). */
export const OPEN_EDITION_PATHS: Record<EditionRole, string[]> = {
  employer: ["/employer/candidates", "/employer/interviews", "/employer/settings"],
  candidate: ["/candidate/interviews", "/candidate/settings"],
};

export const OPEN_EDITION_HOME: Record<EditionRole, string> = {
  employer: "/employer/interviews",
  candidate: "/candidate/interviews",
};

export function isOpenEdition(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(KEY) === "open";
  } catch {
    return false;
  }
}

export function setOpenEdition(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(KEY, "open");
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // storage unavailable (private mode): the edition simply isn't remembered
  }
}

export function isAllowedInOpenEdition(role: EditionRole, pathname: string): boolean {
  return OPEN_EDITION_PATHS[role].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** True while the open edition is on. Server render and first paint report false, then it updates. */
export function useOpenEdition(): boolean {
  return useSyncExternalStore(subscribe, isOpenEdition, () => false);
}
