"use server";

// GET /projects/:id/team — powers the Settings page's Team tab (page-settings.tsx), replacing
// its old hardcoded 3-person mock. "Team" = every profile in the project's org — this app has
// no separate project_members table (0002_new_user_trigger.sql's own comment: "1:1 — no
// team/invite UI yet"), and profiles' own RLS (0003_rls.sql) already scopes reads to the
// caller's own org, so an org-wide member list is both the correct data model today and the
// natural place to extend from if a real invite flow is ever added.
import { createClient } from "@/lib/supabase/server";
import { initialsFor, avatarColorFor } from "@/lib/user-display";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
  avatar_color: string;
  isCurrentUser: boolean;
}

export async function listProjectTeam(projectId: string): Promise<TeamMember[]> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase.from("projects").select("org_id").eq("id", projectId).single();
  if (projectError) throw projectError;

  const [{ data: members, error: membersError }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("id, name, email, role").eq("org_id", project.org_id).order("created_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);
  if (membersError) throw membersError;

  const currentUserId = auth.user?.id ?? null;

  // Natural signup order, never force-sorted to put the caller first or assumed to be
  // "Owner" — isCurrentUser is just a flag the UI uses to badge whichever row it actually is.
  return members.map((m) => ({
    id: m.id,
    name: m.name ?? "",
    email: m.email,
    role: m.role,
    initials: initialsFor(m.name, m.email),
    avatar_color: avatarColorFor(m.id),
    isCurrentUser: m.id === currentUserId,
  }));
}
