"use client";

import { installSecureFetch } from "@/lib/secureTransport";

// Installed when this module loads in the browser, before any component's effects fetch anything. It does
// nothing unless NEXT_PUBLIC_ENCRYPT_API=true.
installSecureFetch();

export function SecureTransportInstaller() {
  return null;
}
