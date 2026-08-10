"use server";

// GET /projects/:id/billing — Settings page's Billing tab, previously a hardcoded
// "Pro · $49/seat/mo · 3 of 5 seats used · Renews March 14, 2026" block. No payment provider
// is wired in yet (confirmed: no Stripe SDK, no billing columns beyond a plain
// orgs.plan text default 'trial') — this returns only what's actually real: the org's plan
// and its real seat count (profiles in the org). renewalDate stays honestly null rather than
// a fabricated date; the frontend omits that line entirely when null.
//
// Billing is genuinely org-level data, but every other endpoint this session follows
// /api/projects/:id/... (resolving org internally when needed, same pattern team.ts's
// listProjectTeam already uses) rather than a one-off /api/orgs/... path.
import { createClient } from "@/lib/supabase/server";

export interface ProjectBilling {
  plan: string;
  seats: number;
  renewalDate: string | null;
}

export async function getProjectBilling(projectId: string): Promise<ProjectBilling> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase.from("projects").select("org_id").eq("id", projectId).single();
  if (projectError) throw projectError;

  const [{ data: org, error: orgError }, { count: seats, error: seatsError }] = await Promise.all([
    supabase.from("orgs").select("plan").eq("id", project.org_id).single(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("org_id", project.org_id),
  ]);
  if (orgError) throw orgError;
  if (seatsError) throw seatsError;

  return { plan: org.plan, seats: seats ?? 0, renewalDate: null };
}
