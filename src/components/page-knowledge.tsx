"use client";

// Knowledge Base — faithful Tailwind/shadcn port of the handoff page-knowledge.jsx.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/chip";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { createClient } from "@/lib/supabase/client";
import { listSources, createSource, processSource, deleteSource, type SourceRow, type SourceType } from "@/lib/actions/sources";
import { listInsights, deleteInsight, type InsightRow } from "@/lib/actions/insights";
import { extractInsightsForProject } from "@/lib/actions/ai-insights";

const TYPE_OPTIONS = [
  { id: "Docs", icon: <Icons.File size={16} />, label: "Docs" },
  { id: "Audio", icon: <Icons.Mic size={16} />, label: "Audio" },
  { id: "Survey", icon: <Icons.Survey size={16} />, label: "Survey" },
  { id: "Web", icon: <Icons.Link size={16} />, label: "Web" },
];

function inferType(file: File): SourceType {
  if (file.type.startsWith("audio")) return "audio";
  if (file.name.endsWith(".csv")) return "survey";
  return "doc";
}

export function PageKnowledge() {
  const store = useStore();
  const { seed } = store;
  const navigate = useNavigate();
  const projectId = store.activeProjectId;
  const [sources, setSources] = React.useState<SourceRow[]>([]);
  const [insights, setInsights] = React.useState<InsightRow[]>([]);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [extracting, setExtracting] = React.useState(false);
  const [extractResult, setExtractResult] = React.useState<string | null>(null);
  const [activeType, setActiveType] = React.useState("Docs");
  const [dragOver, setDragOver] = React.useState(false);
  const [tab, setTab] = React.useState("Interviews");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(async () => {
    if (!projectId) return;
    const [nextSources, nextInsights] = await Promise.all([listSources(projectId), listInsights(projectId)]);
    setSources(nextSources);
    setInsights(nextInsights);
  }, [projectId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const onFiles = async (files: FileList) => {
    if (!projectId) return;
    setUploadError(null);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const path = `${projectId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("sources").upload(path, file);
      if (uploadErr) {
        setUploadError(`Couldn't upload ${file.name}: ${uploadErr.message}`);
        continue;
      }
      try {
        const created = await createSource({ projectId, name: file.name, type: inferType(file), storageUrl: path });
        await processSource(created.id);
      } catch (err) {
        console.error("[knowledge] failed to record or process source", err);
        setUploadError(`Uploaded ${file.name} but failed to process it — try again.`);
      }
    }
    await refresh();
  };

  const onDeleteSource = async (id: string) => {
    await deleteSource(id);
    await refresh();
  };

  const onDeleteInsight = async (id: string) => {
    await deleteInsight(id);
    await refresh();
  };

  const sourceName = (sourceId: string | null) => sources.find((s) => s.id === sourceId)?.name ?? "Unknown source";

  const onExtractInsights = async () => {
    if (!projectId) return;
    setExtracting(true);
    setExtractResult(null);
    try {
      const result = await extractInsightsForProject(projectId);
      if (result.sourcesProcessed === 0) {
        setExtractResult("No new sources to extract from.");
      } else {
        const failureNote = result.failures.length ? ` (${result.failures.length} source(s) failed — try again later)` : "";
        setExtractResult(`Extracted ${result.insightsCreated} insight(s) from ${result.sourcesProcessed} source(s)${failureNote}.`);
      }
      await refresh();
    } catch (err) {
      console.error("[knowledge] insight extraction failed", err);
      setExtractResult("Couldn't extract insights right now — try again in a moment.");
    } finally {
      setExtracting(false);
    }
  };

  const stats = [
    { label: "Sources", value: sources.length },
    { label: "Interviews", value: 5 },
    { label: "Insights", value: insights.length },
    { label: "Voices", value: 9 },
  ];

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-[18px] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.01em]">Knowledge Base</h2>
            <div className="mt-0.5 text-[13px] text-muted-foreground">Everything the AI Analyst reads from.</div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              Invite participant
            </Button>
            <Button variant="soft" size="sm" onClick={onExtractInsights} disabled={extracting || !projectId}>
              <Icons.Sparkle size={12} /> {extracting ? "Extracting…" : "Extract insights"}
            </Button>
            <Button variant="primary" size="sm">
              <Icons.Plus size={12} /> Add source
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mb-4 grid grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[10px] border border-border bg-white px-3.5 py-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-3">{s.label}</div>
              <div className="mt-0.5 text-[26px] font-semibold tracking-[-0.02em]">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Type selectors */}
        <div className="mb-3.5 grid grid-cols-4 gap-2.5">
          {TYPE_OPTIONS.map((t) => {
            const active = activeType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveType(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-[10px] transition-[background] duration-[120ms]",
                  active
                    ? "border-[1.5px] border-brand-orange bg-brand-orangeLight px-3 py-[11.5px] text-brand-orange700"
                    : "border border-border bg-white px-3 py-3 text-muted-foreground"
                )}
              >
                {t.icon}
                <span className="text-xs font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          {/* Left: dropzone + sources */}
          <div>
            <div
              className={cn(
                "cursor-pointer rounded-xl border-2 border-dashed bg-white p-7 text-center transition-[border,background] duration-150",
                dragOver ? "border-brand-orange bg-brand-orangeLight" : "border-border hover:border-brand-orange hover:bg-brand-orangeLight"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files) onFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) onFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Icons.Upload size={20} stroke="#9CA3AF" className="mx-auto mb-2" />
              <div className="mb-[3px] text-sm font-semibold">Drop files or click to upload</div>
              <div className="text-xs text-muted-foreground">AI reads and extracts insights automatically</div>
              <div className="mt-2 font-mono text-[10px] tracking-[0.04em] text-text-3">PDF · DOCX · MP3 · MP4 · CSV</div>
            </div>

            {uploadError && (
              <div className="mt-2.5 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#7F1D1D]">{uploadError}</div>
            )}

            {extractResult && (
              <div className="mt-2.5 rounded-[10px] border border-brand-orange100 bg-brand-orangeLight px-3 py-2 text-xs text-brand-orange700">
                {extractResult}
              </div>
            )}

            <div className="mt-3.5 flex flex-col gap-2">
              {sources.map((s) => {
                const icon =
                  s.type === "audio" ? <Icons.Mic size={14} /> : s.type === "survey" ? <Icons.Survey size={14} /> : <Icons.File size={14} />;
                const complete = s.status === "complete";
                const failed = s.status === "failed";
                const unsupported = s.status === "unsupported";
                return (
                  <div key={s.id} className="flex items-center gap-2.5 rounded-[10px] border border-border bg-white px-3 py-2.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-bg text-muted-foreground">{icon}</span>
                    <div className="min-w-0 flex-1 truncate text-[13px] font-medium">{s.name}</div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
                        complete
                          ? "bg-[#ECFDF5] text-[#065F46]"
                          : failed
                            ? "bg-[#FEF2F2] text-[#7F1D1D]"
                            : unsupported
                              ? "bg-[#F3F4F6] text-[#4B5563]"
                              : "bg-brand-orangeLight text-brand-orange700"
                      )}
                    >
                      {s.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteSource(s.id)}
                      className="border-0 bg-transparent text-muted-foreground hover:text-brand-dark"
                      aria-label={`Delete ${s.name}`}
                    >
                      <Icons.Trash size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: interviews / insights tabs */}
          <div>
            <div className="mb-2.5 flex border-b border-border">
              {["Interviews", "Surveys", "Themes", "AI Extracted Insight"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "mx-3.5 -mb-px border-b-2 px-0.5 py-2 text-[13px] font-medium first:ml-0",
                    tab === t ? "border-brand-orange text-brand-orange" : "border-transparent text-muted-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab !== "AI Extracted Insight" && (
              <div className="flex flex-col gap-2.5">
                {seed.interviews.map((p) => (
                  <div key={p.id} className="rounded-[10px] border border-border bg-white p-3">
                    <div className="mb-2 flex items-center gap-2.5">
                      <span
                        className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full text-[10px] font-semibold"
                        style={{ background: p.avatar_bg, color: p.avatar_fg }}
                      >
                        {p.initials}
                      </span>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold">{p.name}</div>
                        <div className="font-mono text-[11px] text-text-3">{p.role}</div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
                          p.status === "Complete" ? "bg-[#ECFDF5] text-[#065F46]" : "bg-brand-orangeLight text-brand-orange700"
                        )}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="mb-2 text-[12.5px] italic leading-[1.5] text-brand-dark">&quot;{p.quote}&quot;</div>
                    <div className="flex items-center justify-between">
                      <Chip category={p.tag} />
                      <button
                        className="border-0 bg-transparent text-xs font-medium text-brand-orange"
                        onClick={() => navigate("/signals")}
                      >
                        + Add to Signals →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "AI Extracted Insight" && (
              <div className="flex flex-col gap-2.5">
                {insights.length === 0 && (
                  <div className="rounded-[10px] border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    No insights yet — extract some from your sources.
                  </div>
                )}
                {insights.map((i) => (
                  <div key={i.id} className="rounded-[10px] border border-border bg-white p-3">
                    <div className="mb-2 flex items-center gap-1.5">
                      {i.actor_type && (
                        <span className="inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] bg-[#EFF6FF] text-[#1D4ED8]">
                          {i.actor_type}
                        </span>
                      )}
                      {i.confidence && (
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
                            i.confidence === "high"
                              ? "bg-[#ECFDF5] text-[#065F46]"
                              : i.confidence === "medium"
                                ? "bg-brand-orangeLight text-brand-orange700"
                                : "bg-[#F3F4F6] text-[#4B5563]"
                          )}
                        >
                          {i.confidence}
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[11px] text-text-3">{sourceName(i.source_id)}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteInsight(i.id)}
                        className="border-0 bg-transparent text-muted-foreground hover:text-brand-dark"
                        aria-label="Delete insight"
                      >
                        <Icons.Trash size={14} />
                      </button>
                    </div>
                    <div className="mb-1.5 text-[12.5px] italic leading-[1.5] text-brand-dark">
                      &quot;{i.quote || i.text}&quot;
                    </div>
                    {i.quote && <div className="text-[12px] leading-[1.5] text-muted-foreground">{i.text}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
