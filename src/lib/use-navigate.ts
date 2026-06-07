"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

// Replaces the prototype's hash-based navigate(). Components pass real route paths
// (e.g. "/matrix", "/storyline"); the (app) route group keeps them un-prefixed.
export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (p: string) => router.push(p.startsWith("/") ? p : "/" + p),
    [router]
  );
}

export type Navigate = (p: string) => void;
