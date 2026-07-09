"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/lib/constants";

export interface CurrentUserValue {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
  role: UserRole;
  canChat: boolean;
  department: string | null;
}

const Ctx = createContext<CurrentUserValue | null>(null);

/**
 * Holds the signed-in user, resolved ONCE in the group layout (server side) and
 * shared with all pages via context. Pages read `useCurrentUser()` instead of
 * re-fetching auth on every navigation, so moving between pages is instant
 * (pure client-side) with no per-page server round-trip.
 */
export function CurrentUserProvider({
  value,
  children,
}: {
  value: CurrentUserValue;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCurrentUser(): CurrentUserValue {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  return ctx;
}
