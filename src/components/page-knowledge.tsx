"use client";

// Knowledge Base — faithful Tailwind/shadcn port of the handoff page-knowledge.jsx.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { createClient } from "@/lib/supabase/client";
import {
  listSources,
  createSource,
  createWebSource,
  processSource,
  deleteSource,
  type SourceRow,
  type SourceType,
} from "@/lib/actions/sources";
import { listInsights, deleteInsight, type InsightRow } from "@/lib/actions/insights";
import { listInterviews, createInterview, type InterviewRow, type SteepTag } from "@/lib/actions/interviews";
import { extractInsightsForProject } from "@/lib/actions/ai-insights";

const TYPE_OPTIONS = [
  { id: "Docs", icon: <Icons.File size={16} />, label: "Docs" },
  { id: "Audio", icon: <Icons.Mic size={16} />, label: "Audio" },
  { id: "Survey", icon: <Icons.Survey size={16} />, label: "Survey" },
  { id: "Web", icon: <Icons.Link size={16} />, label: "Web" },
] as const;

// Drives both the file source's `type` column and the file picker's `accept` filter —
// the active tab is now the source of truth instead of guessing from the file itself.
const TYPE_CONFIG: Record<string, { sourceType: SourceType; accept: string }> = {
  Docs: { sourceType: "doc", accept: ".pdf,.txt,.docx" },
  Audio: { sourceType: "audio", accept: "audio/*,video/mp4" },
  Survey: { sourceType: "survey", accept: ".csv" },
};

const RIGHT_TABS = ["All", "Docs", "Audio", "Survey", "Web"] as const;
const STEEP_TAGS: SteepTag[] = ["Social", "Technology", "Economic", "Ecological", "Political"];

const STATUS_BADGE = "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]";

function statusBadgeClass(status: SourceRow["status"] | null) {
  if (status === "complete") return "bg-[#ECFDF5] text-[#065F46]";
  if (status === "failed") return "bg-[#FEF2F2] text-[#7F1D1D]";
  if (status === "unsupported") return "bg-[#F3F4F6] text-[#4B5563]";
  if (status === "processing") return "bg-brand-orangeLight text-brand-orange700";
  return "";
}

function progressBarClass(status: SourceRow["status"]) {
  if (status === "complete") return "w-full bg-[#10B981]";
  if (status === "failed") return "w-full bg-[#EF4444]";
  if (status === "unsupported") return "w-full bg-[#D1D5DB]";
  return "w-1/3 bg-brand-orange"; // processing — indeterminate-looking partial fill
}

interface InviteForm {
  participantName: string;
  role: string;
  tag: SteepTag | "";
  keyQuote: string;
  sourceId: string;
}

const EMPTY_INVITE_FORM: InviteForm = { participantName: "", role: "", tag: "", keyQuote: "", sourceId: "" };

export function PageKnowledge() {
  const store = useStore();
  const navigate = useNavigate();
  const projectId = store.activeProjectId;
  const [sources, setSources] = React.useState<SourceRow[]>([]);
  const [insights, setInsights] = React.useState<InsightRow[]>([]);
  const [interviews, setInterviews] = React.useState<InterviewRow[]>([]);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [extracting, setExtracting] = React.useState(false);
  const [extractResult, setExtractResult] = React.useState<string | null>(null);
  const [activeType, setActiveType] = React.useState("Docs");
  const [dragOver, setDragOver] = React.useState(false);
  const [tab, setTab] = React.useState<(typeof RIGHT_TABS)[number]>("All");
  const [webUrl, setWebUrl] = React.useState("");
  const [addingWeb, setAddingWeb] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteForm, setInviteForm] = React.useState<InviteForm>(EMPTY_INVITE_FORM);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(async () => {
    if (!projectId) return;
    const [nextSources, nextInsights, nextInterviews] = await Promise.all([
      listSources(projectId),
      listInsights(projectId),
      listInterviews(projectId),
    ]);
    setSources(nextSources);
    setInsights(nextInsights);
    setInterviews(nextInterviews);
  }, [projectId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const onFiles = async (files: FileList) => {
    if (!projectId) return;
    setUploadError(null);
    const sourceType = TYPE_CONFIG[activeType]?.sourceType ?? "doc";
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const path = `${projectId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("sources").upload(path, file);
      if (uploadErr) {
        setUploadError(`Couldn't upload ${file.name}: ${uploadErr.message}`);
        continue;
      }
      try {
        const created = await createSource({ projectId, name: file.name, type: sourceType, storageUrl: path });
        await processSource(created.id);
      } catch (err) {
        console.error("[knowledge] failed to record or process source", err);
        setUploadError(`Uploaded ${file.name} but failed to process it — try again.`);
      }
    }
    await refresh();
  };

  const onAddWebSource = async () => {
    if (!projectId || !webUrl.trim()) return;
    setUploadError(null);
    setAddingWeb(true);
    try {
      const source = await createWebSource({ projectId, url: webUrl.trim() });
      if (source.status === "failed") {
        setUploadError(`Couldn't fetch ${webUrl.trim()} — check the URL and try again.`);
      } else {
        setWebUrl("");
      }
    } catch (err) {
      console.error("[knowledge] failed to add web source", err);
      setUploadError("Couldn't add that URL — try again.");
    } finally {
      setAddingWeb(false);
      await refresh();
    }
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

  const onSubmitInvite = async () => {
    if (!inviteForm.participantName.trim()) {
      setInviteError("Participant name is required.");
      return;
    }
    if (!projectId) {
      setInviteError("No active project.");
      return;
    }
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      await createInterview({
        projectId,
        participantName: inviteForm.participantName.trim(),
        role: inviteForm.role.trim() || null,
        tag: inviteForm.tag || null,
        keyQuote: inviteForm.keyQuote.trim() || null,
        sourceId: inviteForm.sourceId || null,
      });
      setInviteOpen(false);
      setInviteForm(EMPTY_INVITE_FORM);
      await refresh();
    } catch (err) {
      console.error("[knowledge] failed to log interview", err);
      setInviteError("Couldn't save that — try again.");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const latestInsight = insights[0];

  const filteredInsights = insights.filter((i) => tab === "All" || i.source_type === tab);

  const stats = [
    { label: "Sources", value: sources.length },
    { label: "Interviews", value: interviews.length },
    { label: "Insights", value: insights.length },
    { label: "Voices", value: new Set(interviews.map((i) => i.participant_name)).size },
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
            <Button variant="ghost" size="sm" onClick={() => setInviteOpen(true)}>
              Invite participant
            </Button>
            <Button variant="soft" size="sm" onClick={onExtractInsights} disabled={extracting || !projectId}>
              <Icons.Sparkle size={12} /> {extracting ? "Extracting…" : "Extract insights"}
            </Button>
            <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()}>
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
            {activeType === "Web" ? (
              <div className="rounded-xl border-2 border-dashed border-border bg-white p-7 text-center">
                <Icons.Link size={20} stroke="#9CA3AF" className="mx-auto mb-2" />
                <div className="mb-[3px] text-sm font-semibold">Add a web source</div>
                <div className="mb-3 text-xs text-muted-foreground">AI reads and extracts insights automatically</div>
                <div className="mx-auto flex max-w-[360px] gap-2">
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onAddWebSource();
                    }}
                    placeholder="https://example.com/article"
                    className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-orange"
                  />
                  <Button variant="primary" size="sm" onClick={onAddWebSource} disabled={addingWeb || !webUrl.trim()}>
                    {addingWeb ? "Adding…" : "Add"}
                  </Button>
                </div>
              </div>
            ) : (
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
                  accept={TYPE_CONFIG[activeType]?.accept}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) onFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Icons.Upload size={20} stroke="#9CA3AF" className="mx-auto mb-2" />
                <div className="mb-[3px] text-sm font-semibold">Drop files or click to upload</div>
                <div className="text-xs text-muted-foreground">AI reads and extracts insights automatically</div>
                <div className="mt-2 font-mono text-[10px] tracking-[0.04em] text-text-3">
                  {activeType === "Audio" ? "MP3 · MP4 · WAV" : activeType === "Survey" ? "CSV" : "PDF · TXT"}
                </div>
              </div>
            )}

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
                  s.type === "audio" ? (
                    <Icons.Mic size={14} />
                  ) : s.type === "survey" ? (
                    <Icons.Survey size={14} />
                  ) : s.type === "web" ? (
                    <Icons.Link size={14} />
                  ) : (
                    <Icons.File size={14} />
                  );
                return (
                  <div key={s.id} className="rounded-[10px] border border-border bg-white px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-bg text-muted-foreground">{icon}</span>
                      <div className="min-w-0 flex-1 truncate text-[13px] font-medium">{s.name}</div>
                      <span className={cn(STATUS_BADGE, statusBadgeClass(s.status))}>{s.status}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteSource(s.id)}
                        className="border-0 bg-transparent text-muted-foreground hover:text-brand-dark"
                        aria-label={`Delete ${s.name}`}
                      >
                        <Icons.Trash size={14} />
                      </button>
                    </div>
                    <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[#F3F4F6]">
                      <div className={cn("h-full rounded-full transition-[width] duration-300", progressBarClass(s.status))} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: AI insights banner + tabs */}
          <div>
            {latestInsight && (
              <div className="mb-3 rounded-[10px] border border-brand-orange100 bg-brand-orangeLight px-3.5 py-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Icons.Sparkle size={12} stroke="#C2410C" />
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-brand-orange700">
                    AI extracted insights (latest)
                  </span>
                </div>
                <div className="text-[13px] leading-[1.55] text-brand-orange700">
                  &quot;{latestInsight.quote || latestInsight.text}&quot;
                </div>
              </div>
            )}

            <div className="mb-2.5 flex border-b border-border">
              {RIGHT_TABS.map((t) => (
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

            <div className="flex flex-col gap-2.5">
              {filteredInsights.length === 0 && (
                <div className="rounded-[10px] border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No insights yet — extract some from your sources.
                </div>
              )}
              {filteredInsights.map((i) => {
                return (
                  <div key={i.id} className="rounded-[10px] border border-border bg-white p-3">
                    <div className="mb-2 flex items-center gap-1.5">
                      {i.source_type && (
                        <span className="inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] bg-[#F3F4F6] text-[#4B5563]">
                          {i.source_type}
                        </span>
                      )}
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
                    {i.quote && <div className="mb-2 text-[12px] leading-[1.5] text-muted-foreground">{i.text}</div>}
                    <div className="flex items-center justify-end">
                      <button
                        className="border-0 bg-transparent text-xs font-medium text-brand-orange"
                        onClick={() => navigate("/signals")}
                      >
                        + Merge into Signal →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Invite participant modal */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          setInviteOpen(o);
          if (!o) {
            setInviteForm(EMPTY_INVITE_FORM);
            setInviteError(null);
          }
        }}
      >
        <DialogContent className="max-w-[480px] rounded-2xl p-6">
          <DialogTitle className="mb-4 text-lg font-semibold tracking-[-0.01em]">Invite participant</DialogTitle>
          <div className="flex flex-col gap-3.5">
            <div>
              <Label htmlFor="participant-name" className="mb-1.5 block text-xs">
                Name
              </Label>
              <Input
                id="participant-name"
                autoFocus
                value={inviteForm.participantName}
                onChange={(e) => setInviteForm((f) => ({ ...f, participantName: e.target.value }))}
                placeholder="e.g. Jan Oosterom"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="participant-role" className="mb-1.5 block text-xs">
                  Role
                </Label>
                <Input
                  id="participant-role"
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. CEO"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">STEEP tag</Label>
                <Select value={inviteForm.tag || "none"} onValueChange={(v) => setInviteForm((f) => ({ ...f, tag: v === "none" ? "" : (v as SteepTag) }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {STEEP_TAGS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="participant-quote" className="mb-1.5 block text-xs">
                Key quote
              </Label>
              <Textarea
                id="participant-quote"
                rows={3}
                value={inviteForm.keyQuote}
                onChange={(e) => setInviteForm((f) => ({ ...f, keyQuote: e.target.value }))}
                placeholder="A notable quote from this conversation"
                className="min-h-[70px]"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Link to source</Label>
              <Select
                value={inviteForm.sourceId || "none"}
                onValueChange={(v) => setInviteForm((f) => ({ ...f, sourceId: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inviteError && (
              <div className="rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-[11px] py-2 text-[12.5px] text-[#EF4444]">{inviteError}</div>
            )}
            <div className="mt-1 flex gap-2">
              <Button variant="primary" className="flex-1" onClick={onSubmitInvite} disabled={inviteSubmitting}>
                {inviteSubmitting ? "Saving…" : "Save participant"}
              </Button>
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
