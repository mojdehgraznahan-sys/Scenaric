"use server";

// Home CEO/Setup view switch (design/2026-10-05/04-home-ceo-view/PROMPTS.md, Prompt 1) —
// reads/writes the caller's own profiles.home_view (0043_home_view_preference.sql). Scoped
// implicitly to auth.uid() via RLS's "update own profile" policy (0003_rls.sql) — no explicit
// userId param needed, same shape as me.ts's getCurrentUser().
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HomeView = "setup" | "ceo";

// null = no explicit choice saved yet; the caller computes its own default (gated on whether
// the viewed project has a primary strategic option) rather than this ever guessing one.
export async function getHomeView(): Promise<HomeView | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("home_view").eq("id", user.id).single();
  if (error) throw error;
  return data.home_view;
}

export async function setHomeView(view: HomeView): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("profiles").update({ home_view: view }).eq("id", user.id);
  if (error) throw error;
  revalidatePath("/home");
  revalidatePath("/dashboard");
}
