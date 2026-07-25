"use server";

// Sources CRUD — backend build order §14 item 4b Phase 1 (docs), extended for
// audio/survey/web ingestion. RLS (supabase/migrations/0003_rls.sql) scopes every query
// to the caller's org via project_id; no manual org/user filtering needed here.
// Storage bytes are uploaded directly from the browser (src/components/page-knowledge.tsx) against
// the "sources" bucket (supabase/migrations/0007_sources_storage.sql) — this file only ever touches
// the sources table row + deleting the resulting Storage object.
import { revalidatePath } from "next/cache";
import { lookup } from "node:dns/promises";
// pdf-parse's index.js has a `!module.parent` "debug mode" check that misfires under
// webpack bundling and tries to read a test fixture off disk — import the inner module
// directly to skip it (a known pdf-parse + Next.js/webpack gotcha).
import pdf from "pdf-parse/lib/pdf-parse.js";
import { createClient } from "@/lib/supabase/server";
import { transcribeMedia } from "@/lib/gemini/client";
import type { Database } from "@/lib/supabase/types";

// Matches the "sources" Storage bucket's allowlist exactly (supabase/migrations/0007_sources_storage.sql
// only accepts these four for audio/video) — Gemini's Files API requires an explicit mimeType.
const AUDIO_MIME_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  wav: "audio/wav",
};

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

// A "web" source has no Storage object — createSource's storageUrl column is reused to
// hold the raw URL instead (no FK/type constraint ties it to Storage, so this is safe).
// deleteSource and the Storage-download path below both know to treat "web" differently.
export async function createWebSource(input: { projectId: string; url: string }): Promise<SourceRow> {
  const source = await createSource({ projectId: input.projectId, name: input.url, type: "web", storageUrl: input.url });
  return processSource(source.id);
}

// §5 — "file finishes upload" trigger: mechanical text extraction, no AI.
export async function processSource(id: string): Promise<SourceRow> {
  const supabase = createClient();
  const { data: source, error: readError } = await supabase
    .from("sources")
    .select("type, name, storage_url")
    .eq("id", id)
    .single();
  if (readError) throw readError;

  if (source.type === "web") {
    return processWebSource(id, source.storage_url);
  }

  if (!source.storage_url) {
    return updateSourceStatus(id, "unsupported");
  }

  const { data: blob, error: downloadError } = await supabase.storage.from("sources").download(source.storage_url);
  if (downloadError || !blob) {
    return updateSourceStatus(id, "failed");
  }

  try {
    if (source.type === "audio") {
      const extension = source.name.toLowerCase().split(".").pop() ?? "";
      const mimeType = AUDIO_MIME_TYPES[extension];
      if (!mimeType) {
        return updateSourceStatus(id, "unsupported");
      }
      const text = await transcribeMedia(blob, mimeType);
      return updateSourceStatus(id, "complete", text.slice(0, MAX_EXTRACTED_TEXT_LENGTH));
    }

    if (source.type === "survey") {
      const text = formatSurveyCsv(await blob.text());
      return updateSourceStatus(id, "complete", text.slice(0, MAX_EXTRACTED_TEXT_LENGTH));
    }

    // "doc" — PDF or plain text, by extension. DOCX and anything else honestly settles
    // into "unsupported" rather than a fake processing state (build-order scope call).
    const extension = source.name.toLowerCase().split(".").pop() ?? "";
    if (extension !== "pdf" && extension !== "txt") {
      return updateSourceStatus(id, "unsupported");
    }
    let text: string;
    if (extension === "pdf") {
      const buffer = Buffer.from(await blob.arrayBuffer());
      const result = await pdf(buffer);
      text = result.text;
    } else {
      text = await blob.text();
    }
    return updateSourceStatus(id, "complete", text.slice(0, MAX_EXTRACTED_TEXT_LENGTH));
  } catch (err) {
    console.error("[sources] extraction failed", err);
    return updateSourceStatus(id, "failed");
  }
}

// Reshapes a survey CSV (header row = questions, each row = one respondent) into
// readable per-respondent text, so the §5 insight-extraction prompt has real Q&A
// structure to quote from instead of a raw comma blob.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  return rows;
}

function formatSurveyCsv(csvText: string): string {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return csvText; // not enough structure to reshape — fall back to raw text
  const [header, ...respondents] = rows;
  return respondents
    .map((row, i) => {
      const pairs = header
        .map((question, col) => {
          const answer = (row[col] ?? "").trim();
          return answer ? `${question.trim()}: ${answer}` : null;
        })
        .filter((p): p is string => p !== null);
      return `Respondent ${i + 1}: ${pairs.join("; ")}`;
    })
    .join("\n");
}

// Basic SSRF guard for a server-side fetch of a user-supplied URL: reject non-http(s)
// schemes and resolve-then-check the hostname against private/loopback/link-local
// ranges before fetching. Known residual gap: this checks the resolved address once
// up front, not the address actually connected to — a DNS-rebinding attacker could
// still swap the record between the check and the fetch. Redirects are refused
// outright (not re-checked) to close the simpler bypass of that same class of hole.
function isPrivateAddress(address: string): boolean {
  const a = address.toLowerCase();
  if (a === "::1" || a === "0.0.0.0") return true;
  const v4 = a.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const o1 = Number(v4[1]);
    const o2 = Number(v4[2]);
    if (o1 === 10 || o1 === 127 || o1 === 0) return true;
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    if (o1 === 192 && o2 === 168) return true;
    if (o1 === 169 && o2 === 254) return true;
  }
  if (a.startsWith("fc") || a.startsWith("fd")) return true; // fc00::/7 (unique local)
  if (/^fe[89ab]/.test(a)) return true; // fe80::/10 (link-local)
  return false;
}

async function processWebSource(id: string, url: string | null): Promise<SourceRow> {
  if (!url) return updateSourceStatus(id, "failed");

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return updateSourceStatus(id, "failed");
    }

    const { address } = await lookup(parsed.hostname);
    if (isPrivateAddress(address)) {
      console.error("[sources] refused to fetch private/internal address for", url);
      return updateSourceStatus(id, "failed");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(parsed.toString(), { signal: controller.signal, redirect: "manual" });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      // Includes 3xx (redirect: "manual" surfaces these rather than following them) —
      // treated as failed rather than silently hopping to an unvalidated location.
      return updateSourceStatus(id, "failed");
    }

    const html = await res.text();
    const text = extractTextFromHtml(html);
    if (!text) return updateSourceStatus(id, "unsupported");
    return updateSourceStatus(id, "complete", text.slice(0, MAX_EXTRACTED_TEXT_LENGTH));
  } catch (err) {
    console.error("[sources] web fetch failed", err);
    return updateSourceStatus(id, "failed");
  }
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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
  const { data: source, error: readError } = await supabase.from("sources").select("type, storage_url").eq("id", id).single();
  if (readError) throw readError;

  const { error } = await supabase.from("sources").delete().eq("id", id);
  if (error) throw error;

  if (source?.storage_url && source.type !== "web") {
    await supabase.storage.from("sources").remove([source.storage_url]);
  }
  revalidatePath("/knowledge");
}
