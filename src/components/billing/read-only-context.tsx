"use client";

import { createContext, useContext } from "react";

const ReadOnlyContext = createContext<string | null>(null);

export function ReadOnlyProvider({ reason, children }: { reason: string | null; children: React.ReactNode }) {
  return <ReadOnlyContext.Provider value={reason}>{children}</ReadOnlyContext.Provider>;
}

/** Reason the organization is read-only (trial ended, unpaid, suspended), or null when writes are allowed. */
export function useReadOnly() {
  return useContext(ReadOnlyContext);
}

let globalReason: string | null = null;
export function setGlobalReadOnlyReason(r: string | null) {
  globalReason = r;
}
/** For non-React code paths (error handlers): the current read-only reason. */
export function getGlobalReadOnlyReason() {
  return globalReason;
}
