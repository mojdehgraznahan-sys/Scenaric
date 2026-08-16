"use server";

// Interviews CRUD — Knowledge Base right column ("+ Invite participant"). Real participant
// name/role/STEEP tag/quote, manually logged — no AI involved in populating this (the §5
// insight-extraction step never produces participant identity). RLS (0003_rls.sql) scopes
// every query to the caller's org via project_id.
//
// inviteParticipant (below) is the one exception to "plain CRUD only" — it's small and
// intrinsically tied to this same modal (participant_email/invited_at only exist to support
// it), so it lives here rather than in a separate actions file the way AI side-effects get
// split into ai-*.ts elsewhere.
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"];
export type SteepTag = NonNullable<InterviewRow["tag"]>;

export async function listInterviews(projectId: string): Promise<InterviewRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createInterview(input: {
  projectId: string;
  participantName: string;
  participantEmail?: string | null;
  role?: string | null;
  tag?: SteepTag | null;
  keyQuote?: string | null;
  sourceId?: string | null;
}): Promise<InterviewRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("interviews")
    .insert({
      project_id: input.projectId,
      participant_name: input.participantName,
      participant_email: input.participantEmail ?? null,
      role: input.role ?? null,
      tag: input.tag ?? null,
      key_quote: input.keyQuote ?? null,
      source_id: input.sourceId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/knowledge");
  return data;
}

// ─────────────────────── "Invite participant" — real outbound email ───────────────────────
// One-way notification only: no public reply link, no new route. The participant record is
// saved first and unconditionally kept even if the email step below fails — an unrelated
// Resend/config hiccup must never lose what the user typed into the modal.

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured — set it in .env.local (see .env.local.example) to send participant invites.");
  return new Resend(apiKey);
}

function renderInviteHtml(participantName: string, projectName: string, focalQuestion: string, inviterName: string): string {
  return `
    <p>Hi ${participantName},</p>
    <p>${inviterName} invited you to share your perspective for <strong>${projectName}</strong>, a scenario-planning
    project exploring: <em>${focalQuestion}</em></p>
    <p>Reply to this email to arrange a time to talk, or share your thoughts directly — every response helps ground
    the scenarios in real, current thinking.</p>
    <p>Thanks,<br/>${inviterName}</p>
  `;
}

export interface InviteParticipantResult {
  interview: InterviewRow;
  emailSent: boolean;
  emailError?: string;
}

export async function inviteParticipant(input: {
  projectId: string;
  participantName: string;
  participantEmail: string;
  role?: string | null;
  tag?: SteepTag | null;
  keyQuote?: string | null;
  sourceId?: string | null;
}): Promise<InviteParticipantResult> {
  const interview = await createInterview({
    projectId: input.projectId,
    participantName: input.participantName,
    participantEmail: input.participantEmail,
    role: input.role,
    tag: input.tag,
    keyQuote: input.keyQuote,
    sourceId: input.sourceId,
  });

  if (!EMAIL_FORMAT.test(input.participantEmail)) {
    return { interview, emailSent: false, emailError: "That doesn't look like a valid email address." };
  }

  try {
    const supabase = createClient();
    const [{ data: project, error: projectError }, { data: authUser }] = await Promise.all([
      supabase.from("projects").select("name, focal_question, refined_focal_question").eq("id", input.projectId).single(),
      supabase.auth.getUser(),
    ]);
    if (projectError) throw projectError;

    let inviterName = "A member of the team";
    if (authUser.user?.id) {
      const { data: profile } = await supabase.from("profiles").select("name, email").eq("id", authUser.user.id).single();
      if (profile) inviterName = profile.name || profile.email;
    }

    const fromAddress = process.env.RESEND_FROM_EMAIL;
    if (!fromAddress) {
      throw new Error("RESEND_FROM_EMAIL is not configured — set it in .env.local (see .env.local.example) to send participant invites.");
    }

    const resend = getResendClient();
    const { error: sendError } = await resend.emails.send({
      from: fromAddress,
      to: input.participantEmail,
      replyTo: authUser.user?.email,
      subject: `You're invited to share input — ${project.name}`,
      html: renderInviteHtml(input.participantName, project.name, project.refined_focal_question ?? project.focal_question, inviterName),
    });
    if (sendError) throw new Error(sendError.message);

    const { data: updated, error: updateError } = await supabase
      .from("interviews")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", interview.id)
      .select()
      .single();
    if (updateError) throw updateError;
    revalidatePath("/knowledge");

    return { interview: updated, emailSent: true };
  } catch (err) {
    console.error("[interviews] failed to send participant invite email", err);
    return { interview, emailSent: false, emailError: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteInterview(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("interviews").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/knowledge");
}
