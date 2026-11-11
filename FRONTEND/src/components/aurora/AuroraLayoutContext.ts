"use client";

import { createContext } from "react";

/** True while a page renders inside a persistent Aurora layout (app/<area>/layout.tsx).
 * In that case the layout already owns the header, so DashboardShell-style wrappers
 * inside pages must render just their children instead of a second shell. */
export const AuroraLayoutContext = createContext(false);
