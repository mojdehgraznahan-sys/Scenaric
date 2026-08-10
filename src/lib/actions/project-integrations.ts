"use server";

// Settings page's "Integrations" tab — previously a static 4-item mock (Slack/Notion/
// Bloomberg/RSS Feeds), all connected:true/false with zero backend. Only Slack and RSS Feeds
// are real here; Notion/Bloomberg stay mock cards with "Connect" disabled (manageable:false)
// — more honest than a button that silently does nothing.
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import Parser from "rss-parser";
import { createClient } from "@/lib/supabase/server";
import { assertSafeExternalUrl } from "@/lib/url-safety";
import { ValidationError } from "@/lib/ai/errors";
import type { Database } from "@/lib/supabase/types";

const SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/services/";

export interface IntegrationCard {
  name: string;
  desc: string;
  connected: boolean;
  // false for Notion/Bloomberg — no backend exists for them, "Connect" stays disabled rather
  // than silently doing nothing.
  manageable: boolean;
  // Truncated webhook/feed URL shown on an already-connected card's "Manage" view.
  detail: string | null;
}

function truncateUrl(url: string): string {
  return url.length > 48 ? url.slice(0, 45) + "…" : url;
}

export async function getProjectIntegrations(projectId: string): Promise<IntegrationCard[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("project_integrations").select("slack_webhook_url, rss_feed_url").eq("project_id", projectId).maybeSingle();
  if (error) throw error;

  return [
    {
      name: "Slack",
      desc: "Push signposts and alerts to channels",
      connected: !!data?.slack_webhook_url,
      manageable: true,
      detail: data?.slack_webhook_url ? truncateUrl(data.slack_webhook_url) : null,
    },
    { name: "Notion", desc: "Sync narratives to your team wiki", connected: false, manageable: false, detail: null },
    { name: "Bloomberg", desc: "Auto-import macro data into Signals", connected: false, manageable: false, detail: null },
    {
      name: "RSS Feeds",
      desc: "Watch sources for relevant signals",
      connected: !!data?.rss_feed_url,
      manageable: true,
      detail: data?.rss_feed_url ? truncateUrl(data.rss_feed_url) : null,
    },
  ];
}

// Test-pings the webhook before saving — never persists an unverified URL.
export async function connectSlack(projectId: string, webhookUrl: string): Promise<void> {
  if (!webhookUrl.startsWith(SLACK_WEBHOOK_PREFIX)) {
    throw new ValidationError("That doesn't look like a Slack Incoming Webhook URL (should start with https://hooks.slack.com/services/).");
  }

  try {
    await sendSlackAlert(webhookUrl, "✅ Scenaric is now connected to this channel.");
  } catch {
    throw new ValidationError("Couldn't reach that Slack webhook — check the URL is still valid and try again.");
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("project_integrations")
    .upsert(
      { project_id: projectId, slack_webhook_url: webhookUrl, slack_connected_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "project_id" }
    );
  if (error) throw error;
  revalidatePath("/settings");
}

export async function disconnectSlack(projectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_integrations")
    .upsert({ project_id: projectId, slack_webhook_url: null, slack_connected_at: null, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
  if (error) throw error;
  revalidatePath("/settings");
}

// Real fetch+parse attempt before saving — same "validate-before-save" discipline as Slack's
// test ping, and the same SSRF guard sources.ts's Knowledge Base web sources already use.
export async function connectRss(projectId: string, feedUrl: string): Promise<void> {
  try {
    await assertSafeExternalUrl(feedUrl);
    const feed = await new Parser().parseURL(feedUrl);
    if (!feed.items || feed.items.length === 0) {
      throw new ValidationError("That URL didn't return any feed items — check it's a real RSS/Atom feed.");
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("Couldn't parse that URL as an RSS/Atom feed — check the address and try again.");
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("project_integrations")
    .upsert(
      { project_id: projectId, rss_feed_url: feedUrl, rss_connected_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "project_id" }
    );
  if (error) throw error;
  revalidatePath("/settings");
}

export async function disconnectRss(projectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_integrations")
    .upsert({ project_id: projectId, rss_feed_url: null, rss_connected_at: null, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
  if (error) throw error;
  revalidatePath("/settings");
}

// Used by indicators-monitoring.ts when a real status change fires, and by connectSlack's own
// test ping above.
export async function sendSlackAlert(webhookUrl: string, text: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
}

// Read-side helpers for the two cron jobs (indicators-monitoring.ts, ai-news-items.ts), which
// run session-less via createAdminClient() — same supabaseClient-injectable convention as
// every other cross-cron-job read this session (getProjectAiSettings, etc.).
export async function getConnectedSlackWebhookUrl(projectId: string, supabaseClient: SupabaseClient<Database>): Promise<string | null> {
  const { data } = await supabaseClient.from("project_integrations").select("slack_webhook_url").eq("project_id", projectId).maybeSingle();
  return data?.slack_webhook_url ?? null;
}

export async function getConnectedRssFeedUrl(projectId: string, supabaseClient: SupabaseClient<Database>): Promise<string | null> {
  const { data } = await supabaseClient.from("project_integrations").select("rss_feed_url").eq("project_id", projectId).maybeSingle();
  return data?.rss_feed_url ?? null;
}
