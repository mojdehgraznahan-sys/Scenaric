"use server";

// Sources CRUD — backend build order §14 item 4b Phase 1. RLS (supabase/migrations/0003_rls.sql)
// scopes every query to the caller's org via project_id; no manual org/user filtering needed here.
// Storage bytes are uploaded directly from the browser (src/components/page-knowledge.tsx) against
// the "sources" bucket (supabase/migrations/0007_sources_storage.sql) — this file only ever touches
// the sources table row + deleting the resulting Storage object.
import { revalidatePath } from "next/cache";
// pdf-parse's index.js has a `!module.parent` "debug mode" check that misfires under
// webpack bundling and tries to read a test fixture off disk — import the inner module
// directly to skip it (a known pdf-parse + Next.js/webpack gotcha).
import pdf from "pdf-parse/lib/pdf-parse.js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

// Soft cap so one huge document doesn't blow up later AI calls' input size.
const MAX_EXTRACTED_TEXT_LENGTH = 100_000;

export type SourceRow = Database["public"]["Tables"]["sources"]["Row"];
export type SourceType = SourceRow["type"];

export async function listSources(projectId: string): Promise<SourceRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createSource(input: {
  projectId: string;
  name: string;
  type: SourceType;
  storageUrl: string;
}): Promise<SourceRow> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("sources")
    .insert({
      project_id: input.projectId,
      name: input.name,
      type: input.type,
      status: "processing",
      storage_url: input.storageUrl,
      uploaded_by: user?.id,
    })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/knowledge");
  return data;
}

// §5 — "file finishes upload" trigger: mechanical text extraction, no AI. PDF/CSV/plain-
// text only for now (build-order scope call); everything else honestly settles into
// "unsupported" rather than a fake processing state.
export async function processSource(id: string): Promise<SourceRow> {
  const supabase = createClient();
  const { data: source, error: readError } = await supabase.from("sources").select("name, storage_url").eq("id", id).single();
  if (readError) throw readError;

  const extension = source.name.toLowerCase().split(".").pop() ?? "";
  const isPdf = extension === "pdf";
  const isPlainText = extension === "csv" || extension === "txt";

  if (!source.storage_url || !(isPdf || isPlainText)) {
    return updateSourceStatus(id, "unsupported");
  }

  const { data: blob, error: downloadError } = await supabase.storage.from("sources").download(source.storage_url);
  if (downloadError || !blob) {
    return updateSourceStatus(id, "failed");
  }

  try {
    let text: string;
    if (isPdf) {
      const buffer = Buffer.from(await blob.arrayBuffer());
      const result = await pdf(buffer);
      text = result.text;
    } else {
      text = await blob.text();
    }
    return updateSourceStatus(id, "complete", text.slice(0, MAX_EXTRACTED_TEXT_LENGTH));
  } catch (err) {
    console.error("[sources] text extraction failed", err);
    return updateSourceStatus(id, "failed");
  }
}

async function updateSourceStatus(id: string, status: SourceRow["status"], extractedText?: string): Promise<SourceRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sources")
    .update({ status, ...(extractedText !== undefined ? { extracted_text: extractedText } : {}) })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/knowledge");
  return data;
}

export async function deleteSource(id: string): Promise<void> {
  const supabase = createClient();
  const { data: source, error: readError } = await supabase.from("sources").select("storage_url").eq("id", id).single();
  if (readError) throw readError;

  const { error } = await supabase.from("sources").delete().eq("id", id);
  if (error) throw error;

  if (source?.storage_url) {
    await supabase.storage.from("sources").remove([source.storage_url]);
  }
  revalidatePath("/knowledge");
}
