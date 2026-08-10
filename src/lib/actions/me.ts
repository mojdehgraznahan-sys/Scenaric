"use server";

// GET /me — the authenticated user's own display-ready profile. The single place that turns
// a session into { id, name, email, role, initials, avatar_color } — reused by the store's own
// currentUser hydration (store.tsx's hydrateFromSession, via a fetch to the route below)
// rather than that hydration querying `profiles` directly itself, so there's exactly one
// source of truth for this derivation.
import { createClient } from "@/lib/supabase/server";
import { initialsFor, avatarColorFor } from "@/lib/user-display";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
  avatar_color: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase.from("profiles").select("id, name, email, role").eq("id", user.id).single();
  if (error) throw error;

  return {
    id: profile.id,
    name: profile.name ?? "",
    email: profile.email,
    role: profile.role,
    initials: initialsFor(profile.name, profile.email),
    avatar_color: avatarColorFor(profile.id),
  };
}
