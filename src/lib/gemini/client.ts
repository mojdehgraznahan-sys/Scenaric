// Server-only. Audio/video transcription for the Knowledge Base via Gemini's native
// audio/video understanding — replaces the earlier OpenAI Whisper call. Mirrors the
// lazy-init + explicit-missing-key-check shape of ../ai/client.ts.
import "server-only";
import { GoogleGenAI, createPartFromUri, FileState } from "@google/genai";

// Auto-updating alias for Google's current recommended Flash model, rather than a pinned
// version — avoids re-hitting a 404 NOT_FOUND every time Google retires an old version out
// from under new API keys (as happened with the previously pinned "gemini-2.5-flash").
// If this ever needs deterministic/reproducible behavior instead (a pinned version, not a
// moving target), the current pinned equivalent is "gemini-3.6-flash" — confirmed live via
// ai.models.list() against this project's own API key, not from documentation. For
// transcription specifically, the latest alias is preferable: we want whatever Google
// currently considers best for this, not a version frozen at implementation time.
const MODEL = "gemini-flash-latest";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured — audio/video transcription in the Knowledge Base requires it. Set it in .env.local (see .env.local.example)."
    );
  }
  return new GoogleGenAI({ apiKey });
}

const TRANSCRIBE_PROMPT = `Transcribe this audio/video recording verbatim. Label speakers
(Speaker 1, Speaker 2, ...) if more than one is distinguishable. Output only the
transcript text — no summary, no commentary, no markdown formatting.`;

export async function transcribeMedia(blob: Blob, mimeType: string): Promise<string> {
  const ai = getClient();

  let file = await ai.files.upload({ file: blob, config: { mimeType } });
  while (file.state === FileState.PROCESSING) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (!file.name) throw new Error("Gemini file upload did not return a name to poll");
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== FileState.ACTIVE || !file.uri) {
    throw new Error(`Gemini file processing failed (state: ${file.state ?? "unknown"})`);
  }

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [TRANSCRIBE_PROMPT, createPartFromUri(file.uri, file.mimeType ?? mimeType)],
  });
  if (!response.text) throw new Error("Gemini returned an empty transcript");
  return response.text;
}
